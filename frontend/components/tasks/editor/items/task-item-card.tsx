"use client"

import type { TaskLevel } from "@/lib/tasks/task-level"
import type { ReactNode } from "react"
import { GripVerticalIcon } from "lucide-react"
import { SortableItemHandle } from "@/components/reui/sortable"
import { Button } from "@/components/ui/button"
import type { TaskItem } from "@/lib/tasks/task-items-state"
import type { TaskItemsActions } from "@/hooks/tasks/use-task-items"
import TaskRequirementCard from "@/components/tasks/task-requirement-card"
import TaskItemForm from "./task-item-form"

interface TaskItemCardProps {
  item: TaskItem
  number: number
  difficultyLevel: TaskLevel
  editing: boolean
  busy: boolean
  actions: TaskItemsActions
  selected: boolean
  menu: ReactNode
}

/** Добавляет к общей карточке сортировку, меню и форму редактирования пункта. */
export default function TaskItemCard({
  item,
  number,
  difficultyLevel,
  editing,
  busy,
  actions,
  selected,
  menu,
}: TaskItemCardProps) {
  return (
    <TaskRequirementCard
      item={item}
      number={number}
      level={difficultyLevel}
      selected={selected}
      leading={
        <SortableItemHandle
          render={<Button type="button" variant="ghost" size="icon-sm" disabled={busy} />}
          aria-label={`Переместить пункт ${number}`}
          className="col-start-1 row-start-1 self-center text-muted-foreground hover:text-foreground"
        >
          <GripVerticalIcon className="size-4" />
        </SortableItemHandle>
      }
      actions={editing ? <div className="size-8" /> : menu}
    >
      {editing ? (
        <TaskItemForm
          key={item.id}
          item={item}
          onSave={(values) => actions.saveDraft({ difficultyLevel, values })}
          onCancel={() => actions.cancelDraft({ difficultyLevel })}
        />
      ) : undefined}
    </TaskRequirementCard>
  )
}
