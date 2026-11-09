"use client"

import type { TaskLevel } from "@/lib/tasks/task-level"
import { useState } from "react"
import { ImportIcon } from "lucide-react"
import type { DeveloperType } from "@/lib/api/task-contract"
import ResponsiveModal from "@/components/ui/responsive-modal"
import { Button } from "@/components/ui/button"
import { taskDifficultyLevels } from "@/lib/tasks/task-items-state"
import type { TaskNode } from "@/lib/tasks/task-tree"
import { useTaskLibrary } from "@/hooks/tasks/use-task-library"
import { importLibraryTemplates, libraryTemplates } from "@/lib/tasks/task-library"
import LibraryBrowser from "@/components/tasks/library/library-browser"

/** Выбор шаблонов из общей библиотеки с сохранением выделения между направлениями. */
export default function TaskItemLibrary({
  difficultyLevel,
  disabled,
  onImport,
}: {
  difficultyLevel: TaskLevel
  disabled: boolean
  onImport: (nodes: TaskNode[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [direction, setDirection] = useState<DeveloperType>("frontend")
  const library = useTaskLibrary(open)
  const templates = libraryTemplates(library.data?.flatMap((section) => section.categories) ?? [])
  const selectedCount = templates.filter((template) => selected.has(template.id)).length
  const title = taskDifficultyLevels.find((level) => level.value === difficultyLevel)?.label
  const toggle = (ids: number[], checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)))
      return next
    })
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) setSelected(new Set())
      }}
      title="Библиотека пунктов"
      description={`Выбранные пункты будут добавлены в сложность «${title}» без категорий. Критерии проверки нужно заполнить после импорта.`}
      trigger={
        <Button type="button" variant="outline" size="lg" disabled={disabled}>
          Импортировать пункты <ImportIcon />
        </Button>
      }
      footer={
        <Button
          type="button"
          disabled={!selectedCount || disabled || library.isFetching || !!library.error}
          onClick={() => {
            onImport(importLibraryTemplates(templates, selected, difficultyLevel))
            setSelected(new Set())
            setOpen(false)
          }}
        >
          Добавить выделенные ({selectedCount})
        </Button>
      }
    >
      <LibraryBrowser
        data={library.data}
        pending={library.isPending}
        error={library.error}
        onRetry={() => void library.refetch()}
        direction={direction}
        onDirectionChange={setDirection}
        selection={{ selected, toggle }}
      />
      <p className="mt-3 text-sm text-muted-foreground">
        Отметьте нужные пункты. Чекбокс категории выделяет все вложенные пункты.
      </p>
    </ResponsiveModal>
  )
}
