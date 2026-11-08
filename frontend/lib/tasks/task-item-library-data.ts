import type { TaskLevel } from "@/lib/tasks/task-level"
import type { TaskItem, TaskItemFields } from "./task-items-state"

export type LibraryItem = TaskItemFields & { id: string }
export interface LibraryCategory {
  id: string
  kind: "category"
  title: string
  children: LibraryNode[]
}
export type LibraryNode = LibraryItem | LibraryCategory
export const isLibraryCategory = (node: LibraryNode): node is LibraryCategory => "children" in node
const item = (id: string, title: string, description: string, criteria: string): LibraryItem => ({
  id,
  title,
  description,
  criteria,
  required: true,
})

/** Локальные шаблоны библиотеки. Импорт создаёт независимые копии, не меняя эти данные. */
export const taskItemLibrary: {
  id: string
  title: string
  nodes: LibraryNode[]
}[] = [
  {
    id: "frontend",
    title: "Фронтенд",
    nodes: [
      item(
        "fe-responsive",
        "Адаптивная вёрстка",
        "Адаптировать интерфейс для телефона, планшета и компьютера.",
        "При ширине от 320 px нет горизонтальной прокрутки; элементы управления доступны.",
      ),
      {
        id: "fe-ui",
        kind: "category",
        title: "Интерфейс",
        children: [
          item(
            "fe-navigation",
            "Навигация",
            "Добавить переходы между разделами и выделение текущего раздела.",
            "Все ссылки ведут на нужные страницы, активный раздел визуально выделен.",
          ),
          {
            id: "fe-forms",
            kind: "category",
            title: "Формы",
            children: [
              item(
                "fe-validation",
                "Валидация полей",
                "Проверять обязательные поля и показывать понятные ошибки.",
                "Пустые значения не отправляются, ошибки исчезают после исправления.",
              ),
              {
                id: "fe-accessibility",
                kind: "category",
                title: "Доступность",
                children: [
                  item(
                    "fe-keyboard",
                    "Управление с клавиатуры",
                    "Обеспечить доступность всех действий без мыши.",
                    "Tab перемещает фокус в логичном порядке, Enter активирует кнопки, фокус заметен.",
                  ),
                ],
              },
            ],
          },
        ],
      },
      {
        id: "fe-data",
        kind: "category",
        title: "Работа с данными",
        children: [
          item(
            "fe-loading",
            "Состояния загрузки и ошибок",
            "Показывать загрузку, пустой результат и ошибку запроса.",
            "При ошибке доступен повтор запроса; пустой список имеет понятное сообщение.",
          ),
        ],
      },
    ],
  },
  {
    id: "fullstack",
    title: "Фуллстек",
    nodes: [
      item(
        "fs-setup",
        "Запуск проекта",
        "Подготовить инструкции запуска клиента и сервера.",
        "Проект запускается по инструкции в чистом окружении; настройки описаны в примере конфигурации.",
      ),
      {
        id: "fs-api",
        kind: "category",
        title: "Сервер и API",
        children: [
          item(
            "fs-crud",
            "Управление ресурсами",
            "Реализовать создание, чтение, изменение и удаление ресурсов.",
            "Операции возвращают корректные результаты, несуществующие ресурсы обрабатываются явно.",
          ),
          {
            id: "fs-storage",
            kind: "category",
            title: "Хранение данных",
            children: [
              item(
                "fs-migrations",
                "Миграции базы данных",
                "Описать структуру данных и миграции для её создания.",
                "Миграции применяются на пустой базе; связи и ограничения сохраняют целостность данных.",
              ),
              {
                id: "fs-integrity",
                kind: "category",
                title: "Целостность",
                children: [
                  item(
                    "fs-transactions",
                    "Атомарные изменения",
                    "Объединить связанные изменения данных в транзакции.",
                    "Ошибка одной операции откатывает связанные изменения; частичное сохранение исключено.",
                  ),
                ],
              },
            ],
          },
        ],
      },
      {
        id: "fs-tests",
        kind: "category",
        title: "Проверки",
        children: [
          item(
            "fs-integration",
            "Интеграционные тесты",
            "Проверить взаимодействие API с базой данных.",
            "Тесты покрывают успешные операции, неверные входные данные и отсутствующие ресурсы.",
          ),
        ],
      },
    ],
  },
]

export function libraryItemIds(nodes: LibraryNode[]): string[] {
  return nodes.flatMap((node) =>
    isLibraryCategory(node) ? libraryItemIds(node.children) : [node.id],
  )
}

/** Копирует выбранные пункты в плоский список; категории библиотеки служат только для навигации. */
export function importLibrarySelection(
  nodes: LibraryNode[],
  selected: Set<string>,
  difficultyLevel: TaskLevel,
  newId: () => string = () => crypto.randomUUID(),
): TaskItem[] {
  return nodes.flatMap((node): TaskItem[] => {
    if (isLibraryCategory(node)) {
      return importLibrarySelection(node.children, selected, difficultyLevel, newId)
    }
    return selected.has(node.id) ? [{ ...node, id: newId(), difficultyLevel }] : []
  })
}
