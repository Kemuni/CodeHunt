"use client"

import { TaskLevel } from "@/lib/tasks/task-level"
import type { ReactNode } from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

import { levelLabels } from "@/lib/tasks/labels"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import ExpandableText from "./expandable-text"

interface TaskRequirementCardProps {
  item: { title: string; description: string; criteria: string; required: boolean }
  number: number
  level: TaskLevel
  selected?: boolean
  leading?: ReactNode
  actions?: ReactNode
  /** Редактор может заменить содержимое карточки формой. */
  children?: ReactNode
}

/** Общая карточка требования. Сортировка, меню и форма передаются редактором извне. */
export default function TaskRequirementCard({
  item,
  number,
  level,
  selected = false,
  leading,
  actions,
  children,
}: TaskRequirementCardProps) {
  return (
    <article
      aria-label={`${number}. ${item.title}`}
      className={cn(
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-md border p-3 transition-colors sm:flex sm:gap-3",
        selected ? "border-primary bg-primary/5" : "hover:bg-background",
      )}
    >
      {leading}
      <div
        aria-hidden="true"
        className={cn(
          "row-start-1 grid size-9 shrink-0 select-none place-items-center rounded-xl bg-primary/10 text-xl font-semibold text-primary sm:size-16 sm:text-3xl",
          leading ? "col-start-2" : "col-start-1",
        )}
      >
        {number}
      </div>
      <div className="col-span-full row-start-2 flex min-w-0 flex-1 flex-col gap-2">
        {children ?? (
          <>
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
                  "ml-auto shrink-0 rounded-full px-2 py-0.5 text-sm font-light",
                  level === TaskLevel.Easy && "bg-dark-green/15 text-dark-green",
                  level === TaskLevel.Medium && "bg-warning-orange/15 text-warning-orange",
                  level === TaskLevel.High && "bg-primary/15 text-primary",
                )}
              >
                {levelLabels[level]}
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
          </>
        )}
      </div>
      {actions && <div className="col-start-3 row-start-1 shrink-0">{actions}</div>}
    </article>
  )
}
