"use client"

import type { ReactNode } from "react"
import { ChevronDownIcon, FolderIcon } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatItemCount } from "@/lib/tasks/task-items-state"
import ExpandableText from "./expandable-text"

interface TaskRequirementGroupProps {
  title: string
  count: number
  selected?: boolean
  leading?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

/** Общая группа требований; редактор передаёт сортировку и меню, содержимое сохраняется при сворачивании. */
export default function TaskRequirementGroup({
  title,
  count,
  selected = false,
  leading,
  actions,
  children,
}: TaskRequirementGroupProps) {
  return (
    <Collapsible
      defaultOpen
      role="group"
      aria-label={`Категория «${title}»`}
      className={cn(
        "min-w-0 rounded-xl border p-2 sm:p-3",
        selected ? "border-primary bg-primary/5" : "bg-muted/20",
      )}
    >
      <div className="flex items-center gap-2">
        {leading}
        <FolderIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <ExpandableText text={title} maxLength={100} className="font-semibold" />
          <span className="text-xs text-muted-foreground">{formatItemCount(count)}</span>
        </div>
        <CollapsibleTrigger
          render={<Button type="button" variant="ghost" size="icon-sm" />}
          className="group"
          aria-label={`Свернуть или раскрыть категорию «${title}»`}
        >
          <ChevronDownIcon
            aria-hidden="true"
            className="transition-transform group-aria-expanded:rotate-180"
          />
        </CollapsibleTrigger>
        {actions}
      </div>
      <CollapsibleContent keepMounted>
        <div className="mt-3 border-l pl-2 sm:pl-4">
          {children ?? (
            <p className="p-3 text-sm text-muted-foreground">В категории пока нет пунктов.</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
