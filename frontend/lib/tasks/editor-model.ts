import { z } from "zod"
import type {
  TaskDetail,
  TaskPublication,
  CompositionLink,
  CompositionGroup,
  ComplicationItem,
  ComplicationGroupRead,
  Level,
  PresetCreate,
} from "@/lib/api/task-contract"
import type { DraftPayload } from "@/lib/api/tasks"
import { isCategory, countTaskItems, type TaskNode } from "./task-tree"
import type { TaskDifficultyLevel } from "./task-items-state"

export const levelToApi: Record<TaskDifficultyLevel, Level> = {
  base: "easy",
  medium: "medium",
  maximum: "high",
}
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
  presets: {
    easy: { description: "", averageDays: "" },
    medium: { description: "", averageDays: "" },
    high: { description: "", averageDays: "" },
  },
}
/** Уровень появляется по содержимому; одно только время выполнения не включает пустой уровень. */
export function hasLevelContent(info: TaskInfo, nodes: TaskNode[], level: Level) {
  return (
    !!info.presets[level].description.trim() ||
    countTaskItems(nodes.filter((node) => levelToApi[node.difficultyLevel] === level)) > 0
  )
}

/** Проверяет уровни по текущему дереву: для непустого уровня backend требует описание. */
export function createTaskInfoSchema(nodes: TaskNode[]) {
  return taskInfoSchema.superRefine((info, context) => {
    const levels = (Object.keys(info.presets) as Level[]).filter((level) =>
      hasLevelContent(info, nodes, level),
    )
    if (!levels.length)
      context.addIssue({
        code: "custom",
        path: ["presets", "easy", "description"],
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

/** Проецирует общее дерево API на вкладки сложности, сохраняя серверные ID групп и пунктов. */
export function fromComposition(items: ApiNode[]): TaskNode[] {
  const visit = (
    nodes: ApiNode[],
    difficultyLevel: TaskDifficultyLevel,
    path: string,
  ): TaskNode[] =>
    nodes.flatMap((node, index): TaskNode[] => {
      const key = `${path}-${index}`
      if (isGroup(node)) {
        const children = visit(node.items ?? [], difficultyLevel, key)
        if (!children.length && (node.items?.length || difficultyLevel !== "base")) return []
        return [
          {
            kind: "category",
            id: node.id ?? `local-group-${key}-${difficultyLevel}`,
            title: node.title,
            difficultyLevel,
            children,
          },
        ]
      }
      if (node.level !== levelToApi[difficultyLevel]) return []
      return [
        {
          id: node.id ?? `local-item-${key}`,
          complicationId: node.complication_id ?? null,
          difficultyLevel,
          title: node.title,
          description: node.description,
          criteria: node.acceptance_criteria,
          required: node.is_required ?? false,
        },
      ]
    })
  return (Object.keys(levelToApi) as TaskDifficultyLevel[]).flatMap((level) =>
    visit(items, level, "root"),
  )
}

/** Объединяет проекции общих групп и передаёт ID только тех узлов, которые уже существуют на сервере. */
export function toComposition(nodes: TaskNode[]): Array<CompositionLink | CompositionGroup> {
  const result = serializeNodes(nodes)
  const groupIds = new Set<number>()
  const visit = (items: Array<CompositionLink | CompositionGroup>) => {
    for (const item of items) {
      if (item.kind !== "group") continue
      // После переноса части общей группы в другую ветку API создаёт для неё отдельную группу.
      if (item.id) {
        if (groupIds.has(item.id)) delete item.id
        else groupIds.add(item.id)
      }
      visit(item.items ?? [])
    }
  }
  visit(result)
  return result
}
function serializeNodes(nodes: TaskNode[]): Array<CompositionLink | CompositionGroup> {
  const result: Array<CompositionLink | CompositionGroup> = []
  for (const node of nodes) {
    if (isCategory(node)) {
      const existing =
        typeof node.id === "number"
          ? result.find(
              (n): n is CompositionGroup =>
                n.kind === "group" && n.id === node.id && n.title === node.title,
            )
          : undefined
      if (existing) {
        existing.items = mergeGroups([...(existing.items ?? []), ...serializeNodes(node.children)])
      } else
        result.push({
          kind: "group",
          ...(typeof node.id === "number" ? { id: node.id } : {}),
          title: node.title,
          items: serializeNodes(node.children),
        })
    } else
      result.push({
        kind: "complication",
        ...(typeof node.id === "number" ? { id: node.id } : {}),
        complication_id: node.complicationId ?? null,
        title: node.title,
        description: node.description,
        acceptance_criteria: node.criteria,
        level: levelToApi[node.difficultyLevel],
        is_required: node.required,
      })
  }
  return result
}
function mergeGroups(nodes: Array<CompositionLink | CompositionGroup>) {
  const merged: Array<CompositionLink | CompositionGroup> = []
  for (const node of nodes) {
    const previous =
      node.kind === "group" && node.id
        ? merged.find(
            (n): n is CompositionGroup =>
              n.kind === "group" && n.id === node.id && n.title === node.title,
          )
        : undefined
    if (previous && node.kind === "group")
      previous.items = mergeGroups([...(previous.items ?? []), ...(node.items ?? [])])
    else merged.push(node)
  }
  return merged
}

/** Восстанавливает значения полей из задачи или неполного черновика, включая выбранные уровни. */
export function infoFromPayload(data: DraftPayload | TaskDetail): TaskInfo {
  const presets = Array.isArray(data.presets) ? (data.presets as PresetCreate[]) : []
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
    presets: Object.fromEntries(
      Object.entries(emptyInfo.presets).map(([key, value]) => {
        const preset = presets.find((p) => p.level === key)
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
    items: toComposition(nodes),
    presets: Object.entries(info.presets)
      .filter(([level]) => hasLevelContent(info, nodes, level as Level))
      .map(([level, value]) => ({
        level,
        description: value.description,
        average_days_to_complete: value.averageDays ? Number(value.averageDays) : null,
      })),
  }
}
/** Создаёт тело публикации из данных, уже проверенных taskInfoSchema. */
export function publication(
  info: z.infer<typeof taskInfoSchema>,
  nodes: TaskNode[],
): TaskPublication {
  return toPayload(info, nodes) as TaskPublication
}
