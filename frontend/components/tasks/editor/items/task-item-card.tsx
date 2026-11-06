"use client"

import type { ReactNode } from "react"
import { ChevronDownIcon, GripVerticalIcon } from "lucide-react"
import { SortableItemHandle } from "@/components/reui/sortable"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  taskDifficultyLevels,
  type TaskDifficultyLevel,
  type TaskItem,
} from "@/lib/tasks/task-items-state"
import type { TaskItemsActions } from "@/hooks/tasks/use-task-items"
import TaskItemForm from "./task-item-form"
import ExpandableText from "@/components/tasks/expandable-text"
import { cn } from "cn"

interface TaskItemCardProps {
  item: TaskItem
  number: number
  difficultyLevel: TaskDifficultyLevel
  editing: boolean
  busy: boolean
  actions: TaskItemsActions
  selected: boolean
  menu: ReactNode
}

/** Карточка пункта: переключает просмотр и форму редактирования, показывает меню и ручку сортировки. Изменения списка делегирует actions. */
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
  const difficultyLevelLabel = taskDifficultyLevels.find(
    (entry) => entry.value === difficultyLevel,
  )?.label

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-md border p-3 transition-colors sm:flex sm:gap-3",
        selected ? "border-primary bg-primary/5" : "hover:bg-background",
      )}
    >
      <SortableItemHandle
        render={<Button type="button" variant="ghost" size="icon-sm" disabled={busy} />}
        aria-label={`Переместить пункт ${number}`}
        className="col-start-1 row-start-1 self-center text-muted-foreground hover:text-foreground"
      >
        <GripVerticalIcon className="size-4" />
      </SortableItemHandle>
      <div className="col-start-2 row-start-1 grid size-9 shrink-0 select-none place-items-center rounded-xl bg-primary/10 text-xl font-semibold text-primary sm:size-16 sm:text-3xl">
        {number}
      </div>
      {editing ? (
        <div className="col-span-full row-start-2 min-w-0 flex-1">
          <TaskItemForm
            key={item.id}
            item={item}
            onSave={(values) => actions.saveDraft({ difficultyLevel, values })}
            onCancel={() => actions.cancelDraft({ difficultyLevel })}
          />
        </div>
      ) : (
        <div className="col-span-full row-start-2 flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 text-xl font-semibold">
              <ExpandableText as="span" text={item.title} maxLength={160} maxLines={2} />
              {!item.required && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (необязательно)
                </span>
              )}
            </h3>
            <span
              className={cn(
                "ml-auto shrink-0 rounded-full  px-2 py-0.5 text-sm font-light ",
                difficultyLevel === "base" && "bg-dark-green/15 text-dark-green",
                difficultyLevel === "medium" && "bg-warning-orange/15 text-warning-orange",
                difficultyLevel === "maximum" && "bg-primary/15 text-primary",
              )}
            >
              {difficultyLevelLabel}
            </span>
          </div>
          <ExpandableText text={item.description} className="text-base" />
          <Collapsible>
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className="hover:bg-primary/5 aria-expanded:bg-primary/5 text-primary!"
                />
              }
              className="group w-fit justify-start"
            >
              Критерии проверки
              <ChevronDownIcon
                aria-hidden="true"
                className="transition-transform group-aria-expanded:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent keepMounted>
              <ExpandableText
                text={item.criteria}
                maxLines={5}
                maxLength={500}
                className="mt-1 border-l border-primary bg-primary/5 px-3 py-2 text-sm text-primary"
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
      <div className="col-start-3 row-start-1 shrink-0">
        {editing ? <div className="size-8" /> : menu}
      </div>
    </div>
  )
}
