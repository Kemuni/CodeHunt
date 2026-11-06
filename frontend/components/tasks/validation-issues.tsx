import type { ValidationProblem } from "@/lib/api/task-request"

const fields: Record<string, string> = {
  slug: "Адрес задачи",
  title: "Название",
  short_description: "Краткое описание",
  full_description: "Описание",
  developer_type: "Направление разработки",
  difficulty_from: "Минимальная сложность",
  difficulty_to: "Максимальная сложность",
  design_author_name: "Автор дизайна",
  design_author_link: "Ссылка на дизайнера",
  presets: "Уровни задачи",
  items: "Пункты",
  acceptance_criteria: "Критерии проверки",
  description: "Описание",
  level: "Уровень",
  average_days_to_complete: "Время выполнения",
}
/** Показывает ошибки backend и переводит пути полей в подписи; индексы пунктов нумеруются с единицы. */
export function ValidationIssues({ issues }: { issues: ValidationProblem[] }) {
  if (!issues.length) return null
  return (
    <div role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <h2 className="font-semibold text-destructive">
        Что нужно исправить перед сохранением задачи
      </h2>
      <ul className="mt-2 max-h-64 list-inside list-disc overflow-y-auto text-sm">
        {issues.map((issue, index) => (
          <li key={`${issue.field}-${index}`}>
            <span className="font-medium">
              {issue.field
                .split(".")
                .map((key) => fields[key] ?? (/^\d+$/.test(key) ? String(Number(key) + 1) : key))
                .join(" → ") || "Задача"}
              :{" "}
            </span>
            {issue.code === "missing"
              ? "Заполните обязательное поле"
              : issue.code === "string_too_short"
                ? "Значение не может быть пустым"
                : issue.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
