import { TaskLevel } from "@/lib/tasks/task-level"
import { z } from "zod"
import type {
  TaskDetail,
  TaskPresets,
  TaskSave,
  CompositionLink,
  CompositionGroup,
  ComplicationItem,
  ComplicationGroupRead,
  PresetCreate,
} from "@/lib/api/task-contract"
import type { DraftPayload } from "@/lib/api/tasks"
import { isCategory, type TaskNode } from "./task-tree"

const nonempty = (name: string, max: number) =>
  z.string().trim().min(1, `Заполните ${name}`).max(max, `Максимум ${max} символов`)
const presetSchema = z.object({
  description: z.string().trim().max(100000, "Максимум 100000 символов"),
  averageDays: z.string(),
})

/** Zod проверяет заполненную форму при сохранении задачи; для автосохранения допустим неполный ввод. */
export const taskInfoSchema = z.object({
  title: nonempty("название задачи", 255),
  slug: nonempty("адрес задачи", 255).regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Только латинские строчные буквы, цифры и дефис",
  ),
  designerAuthor: z.string().trim().max(255),
  designerLink: z
    .string()
    .trim()
    .max(2083)
    .refine(
      (v) => !v || z.url({ protocol: /^https?$/ }).safeParse(v).success,
      "Введите ссылку http или https",
    ),
  shortDescription: nonempty("краткое описание", 300),
  fullDescription: nonempty("полное описание", 100000),
  developerType: z.enum(["frontend", "fullstack"], { error: "Выберите направление разработки" }),
  difficulty: z
    .tuple([z.number().int().min(0).max(10), z.number().int().min(0).max(10)])
    .refine(([a, b]) => a <= b, "Минимальная сложность больше максимальной"),
  isHidden: z.boolean(),
  isPaid: z.boolean(),
  presets: z.object({ easy: presetSchema, medium: presetSchema, high: presetSchema }),
})
/** Значения react-hook-form до проверки: пустое направление показывает placeholder, но не проходит submit. */
export type TaskInfo = Omit<z.infer<typeof taskInfoSchema>, "developerType"> & {
  developerType?: "frontend" | "fullstack"
}
export const emptyInfo: TaskInfo = {
  title: "",
  slug: "",
  designerAuthor: "",
  designerLink: "",
  shortDescription: "",
  fullDescription: "",
  developerType: undefined,
  difficulty: [2, 6],
  isHidden: false,
  isPaid: false,
  presets: {
    easy: { description: "", averageDays: "" },
    medium: { description: "", averageDays: "" },
    high: { description: "", averageDays: "" },
  },
}
/** Уровень появляется по содержимому; одно только время выполнения не включает пустой уровень. */
export function hasLevelContent(info: TaskInfo, nodes: TaskNode[], level: TaskLevel) {
  return (
    !!info.presets[level].description.trim() || nodes.some((node) => node.difficultyLevel === level)
  )
}

/** Проверяет уровни по текущему дереву: для непустого уровня backend требует описание. */
export function createTaskInfoSchema(nodes: TaskNode[]) {
  return taskInfoSchema.superRefine((info, context) => {
    const levels = (Object.keys(info.presets) as TaskLevel[]).filter((level) =>
      hasLevelContent(info, nodes, level),
    )
    if (!levels.length)
      context.addIssue({
        code: "custom",
        path: ["presets", TaskLevel.Easy, "description"],
        message: "Добавьте пункты или описание хотя бы одного уровня",
      })
    for (const level of levels) {
      const preset = info.presets[level]
      if (!preset.description)
        context.addIssue({
          code: "custom",
          path: ["presets", level, "description"],
          message: "Заполните описание уровня с пунктами",
        })
      const days = preset.averageDays
      if (days && (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 32767))
        context.addIssue({
          code: "custom",
          path: ["presets", level, "averageDays"],
          message: "Укажите целое число дней от 1 до 32767",
        })
    }
  })
}

type ApiNode = CompositionLink | CompositionGroup | ComplicationItem | ComplicationGroupRead
const isGroup = (node: ApiNode): node is CompositionGroup | ComplicationGroupRead =>
  node.kind === "group"

/** Каждый узел, включая пустую группу, имеет собственный уровень и серверный ID. */
export function fromComposition(items: ApiNode[]): TaskNode[] {
  return compositionNodes(items, "root")
}

export function fromPresets(presets: TaskPresets): TaskNode[] {
  return Object.values(TaskLevel).flatMap((level) =>
    compositionNodes(presets[level].complications, level),
  )
}

function compositionNodes(nodes: ApiNode[], path: string): TaskNode[] {
  return nodes.map((node, index): TaskNode => {
    const key = `${path}-${index}`
    const difficultyLevel = node.level
    if (isGroup(node)) {
      return {
        kind: "category",
        id: node.id ?? `local-group-${key}`,
        title: node.title,
        difficultyLevel,
        children: compositionNodes(node.items ?? [], key),
      }
    }
    return {
      id: node.id ?? `local-item-${key}`,
      complicationId: node.complication_id ?? null,
      difficultyLevel,
      title: node.title,
      description: node.description,
      criteria: node.acceptance_criteria,
      required: node.is_required ?? false,
    }
  })
}

/** Сохраняет явный уровень групп; перенос между вкладками меняет level, а не ID. */
export function toComposition(nodes: TaskNode[]): Array<CompositionLink | CompositionGroup> {
  return nodes.map((node) => {
    const identity = typeof node.id === "number" ? { id: node.id } : {}
    if (isCategory(node)) {
      return {
        kind: "group",
        ...identity,
        title: node.title,
        level: node.difficultyLevel,
        items: toComposition(node.children),
      }
    }
    return {
      kind: "complication",
      ...identity,
      complication_id: node.complicationId ?? null,
      title: node.title,
      description: node.description,
      acceptance_criteria: node.criteria,
      level: node.difficultyLevel,
      is_required: node.required,
    }
  })
}

/** Читает метаданные задачи по ключам уровней без поиска в общем списке пресетов. */
export function infoFromTask(task: TaskDetail): TaskInfo {
  return infoFromData(task, (level) => task.presets[level].preset)
}

/** Восстанавливает поля неполного черновика, который хранит формат записи API. */
export function infoFromPayload(data: DraftPayload): TaskInfo {
  const presets = Array.isArray(data.presets) ? (data.presets as PresetCreate[]) : []
  return infoFromData(data, (level) => presets.find((preset) => preset.level === level))
}

function infoFromData(
  data: DraftPayload | TaskDetail,
  presetForLevel: (level: TaskLevel) => PresetCreate | null | undefined,
): TaskInfo {
  const text = (key: string) =>
    typeof (data as DraftPayload)[key] === "string" ? ((data as DraftPayload)[key] as string) : ""
  return {
    title: text("title"),
    slug: text("slug"),
    designerAuthor: text("design_author_name"),
    designerLink: text("design_author_link"),
    shortDescription: text("short_description"),
    fullDescription: text("full_description"),
    developerType:
      data.developer_type === "frontend" || data.developer_type === "fullstack"
        ? data.developer_type
        : undefined,
    difficulty: [
      typeof data.difficulty_from === "number" ? data.difficulty_from : 2,
      typeof data.difficulty_to === "number" ? data.difficulty_to : 6,
    ],
    isHidden: data.is_hidden === true,
    isPaid: data.is_paid === true,
    presets: Object.fromEntries(
      Object.entries(emptyInfo.presets).map(([key, value]) => {
        const preset = presetForLevel(key as TaskLevel)
        return [
          key,
          preset
            ? {
                description: preset.description,
                averageDays: preset.average_days_to_complete
                  ? String(preset.average_days_to_complete)
                  : "",
              }
            : { ...value },
        ]
      }),
    ) as TaskInfo["presets"],
  }
}
/** Переводит поля формы и дерево в формат API, сохраняя дополнительные поля исходного черновика. */
export function toPayload(
  info: TaskInfo,
  nodes: TaskNode[],
  original: DraftPayload = {},
): DraftPayload {
  return {
    ...original,
    title: info.title,
    slug: info.slug,
    short_description: info.shortDescription,
    full_description: info.fullDescription,
    developer_type: info.developerType ?? null,
    difficulty_from: info.difficulty[0],
    difficulty_to: info.difficulty[1],
    design_author_name: info.designerAuthor || null,
    design_author_link: info.designerLink || null,
    is_hidden: info.isHidden,
    is_paid: info.isPaid,
    items: toComposition(nodes),
    presets: Object.entries(info.presets)
      .filter(([level]) => hasLevelContent(info, nodes, level as TaskLevel))
      .map(([level, value]) => ({
        level,
        description: value.description,
        average_days_to_complete: value.averageDays ? Number(value.averageDays) : null,
      })),
  }
}
/** Создаёт тело публикации из данных, уже проверенных taskInfoSchema. */
export function publication(info: z.infer<typeof taskInfoSchema>, nodes: TaskNode[]): TaskSave {
  return toPayload(info, nodes) as TaskSave
}
