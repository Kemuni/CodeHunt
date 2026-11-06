"use client"

import { useState } from "react"
import { ChevronDownIcon, ImportIcon } from "lucide-react"
import ResponsiveModal from "@/components/ui/responsive-modal"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  taskDifficultyLevels,
  formatItemCount,
  type TaskDifficultyLevel,
} from "@/lib/tasks/task-items-state"
import type { TaskNode } from "@/lib/tasks/task-tree"
import {
  taskItemLibrary,
  isLibraryCategory,
  libraryItemIds,
  importLibrarySelection,
  type LibraryNode,
} from "@/lib/tasks/task-item-library-data"
import ExpandableText from "@/components/tasks/expandable-text"
import { cn } from "cn"

function LibraryTree({
  nodes,
  selected,
  toggle,
}: {
  nodes: LibraryNode[]
  selected: Set<string>
  toggle: (ids: string[], checked: boolean) => void
}) {
  return (
    <div className="space-y-2">
      {nodes.map((node) => {
        const category = isLibraryCategory(node)
        const ids = category ? libraryItemIds(node.children) : [node.id]
        const count = ids.filter((id) => selected.has(id)).length
        const checkbox = (
          <Checkbox
            aria-label={`Выбрать ${category ? "категорию" : "пункт"} «${node.title}»`}
            checked={ids.length > 0 && count === ids.length}
            indeterminate={count > 0 && count < ids.length}
            onCheckedChange={(checked) => toggle(ids, checked)}
          />
        )
        return category ? (
          <Collapsible
            key={node.id}
            defaultOpen
            className={cn(
              "rounded-lg border p-2 transition-colors sm:p-3",
              count > 0 && "border-primary bg-primary/5",
              count > 0 && count < ids.length && "border-dashed",
            )}
          >
            <div className="flex items-center gap-3">
              {checkbox}
              <span className="min-w-0 flex-1 font-medium">
                {node.title}{" "}
                <span className="font-normal text-muted-foreground">
                  ({formatItemCount(ids.length)})
                </span>
              </span>
              <CollapsibleTrigger
                render={<Button type="button" variant="ghost" size="icon-sm" />}
                className="group"
                aria-label={`Свернуть или раскрыть категорию «${node.title}»`}
              >
                <ChevronDownIcon className="shrink-0 transition-transform group-aria-expanded:rotate-180" />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent keepMounted className="pt-2 pl-2 sm:pl-4">
              <LibraryTree nodes={node.children} selected={selected} toggle={toggle} />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div
            key={node.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 transition-colors",
              count > 0 && "border-primary bg-primary/5",
              count > 0 && count < ids.length && "border-dashed",
            )}
          >
            <div className="pt-1">{checkbox}</div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">{node.title}</h3>
              <ExpandableText
                text={node.description}
                maxLength={180}
                className="mt-1 text-sm text-muted-foreground"
              />
              <Collapsible>
                <CollapsibleTrigger
                  render={<Button type="button" variant="link" size="sm" />}
                  className="px-0"
                >
                  Критерии проверки
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ExpandableText text={node.criteria} className="text-sm" />
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Выбор шаблонов из библиотеки. Сохраняет выделение между вкладками и импортирует копии в текущую сложность. */
export default function TaskItemLibrary({
  difficultyLevel,
  disabled,
  onImport,
}: {
  difficultyLevel: TaskDifficultyLevel
  disabled: boolean
  onImport: (nodes: TaskNode[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState("frontend")
  const title = taskDifficultyLevels.find((level) => level.value === difficultyLevel)?.label
  const toggle = (ids: string[], checked: boolean) =>
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
      description={`Выбранные пункты будут добавлены в сложность «${title}» без категорий.`}
      trigger={
        <Button type="button" variant="outline" size="lg" disabled={disabled}>
          Импортировать пункты <ImportIcon />
        </Button>
      }
      footer={
        <Button
          type="button"
          disabled={!selected.size || disabled}
          onClick={() => {
            const nodes = taskItemLibrary.flatMap((section) =>
              importLibrarySelection(section.nodes, selected, difficultyLevel),
            )
            onImport(nodes)
            setSelected(new Set())
            setOpen(false)
          }}
        >
          Добавить выделенные ({selected.size})
        </Button>
      }
    >
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (typeof value === "string") setTab(value)
        }}
      >
        <TabsList variant="line">
          {taskItemLibrary.map((section) => (
            <TabsTrigger key={section.id} value={section.id}>
              {section.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {taskItemLibrary.map((section) => (
          <TabsContent key={section.id} value={section.id} keepMounted className="pt-2">
            <LibraryTree nodes={section.nodes} selected={selected} toggle={toggle} />
          </TabsContent>
        ))}
      </Tabs>
      <p className="mt-3 text-sm text-muted-foreground">
        Отметьте нужные пункты. Чекбокс категории выделяет все вложенные пункты.
      </p>
    </ResponsiveModal>
  )
}
