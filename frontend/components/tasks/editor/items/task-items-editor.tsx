"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ChevronDownIcon, FolderIcon, GripVerticalIcon, GroupIcon, PlusIcon } from "lucide-react"
import { Sortable, SortableItem, SortableItemHandle } from "@/components/reui/sortable"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  SectionLayout,
  SectionLayoutActions,
  SectionLayoutContent,
  SectionLayoutDescription,
  SectionLayoutHeader,
  SectionLayoutHeaderRow,
} from "@/components/ui/layouts/section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatItemCount,
  taskDifficultyLevels,
  type TaskDifficultyLevel,
  type TaskItemDraft,
} from "@/lib/tasks/task-items-state"
import {
  countTaskItems,
  taskItemNumbers,
  groupNodes,
  isCategory,
  nodeKey,
  selectedRoots,
  updateChildren,
  type TaskNode,
} from "@/lib/tasks/task-tree"
import { useTaskItems, type TaskItemsActions } from "@/hooks/tasks/use-task-items"
import TaskItemCard from "./task-item-card"
import TaskNodeMenu from "./task-node-menu"
import TaskItemLibrary from "@/components/tasks/editor/library/task-item-library"
import ExpandableText from "@/components/tasks/expandable-text"
import TaskCategoryForm from "./task-category-form"
import { shiftSelectionProps } from "./shift-selection"
import { cn } from "cn"

interface TaskTreeProps {
  nodes: TaskNode[]
  roots: TaskNode[]
  numbers: Map<string, number>
  difficultyLevel: TaskDifficultyLevel
  parentId?: string | null
  selected: string[]
  ancestorSelected?: boolean
  draft: TaskItemDraft | null
  actions: TaskItemsActions
  onRename: (id: string, title: string) => void
}

/** Рекурсивное дерево: отдельная сортировка у каждого родителя, категории перемещаются вместе с потомками. */
function TaskTree({
  nodes,
  roots,
  numbers,
  difficultyLevel,
  parentId = null,
  selected,
  ancestorSelected = false,
  draft,
  actions,
  onRename,
}: TaskTreeProps) {
  return (
    <Sortable
      value={nodes}
      getItemValue={nodeKey}
      onValueChange={(items) =>
        actions.reorderItems({ difficultyLevel, parentCategoryId: parentId, items })
      }
      strategy="vertical"
      className="space-y-2"
    >
      {nodes.map((node, index) => {
        const editing = draft && nodeKey(draft.item) === nodeKey(node)
        const checked = ancestorSelected || selected.includes(nodeKey(node))
        const menu = (
          <TaskNodeMenu
            node={node}
            roots={roots}
            difficultyLevel={difficultyLevel}
            index={index}
            total={nodes.length}
            parentId={parentId}
            disabled={!!draft}
            actions={actions}
            onRename={onRename}
          />
        )
        return (
          <SortableItem
            key={nodeKey(node)}
            value={nodeKey(node)}
            role="group"
            aria-disabled={false}
            tabIndex={-1}
            disabled={!!draft}
            className="data-disabled:opacity-100"
            {...shiftSelectionProps(
              () =>
                actions.toggleSelection({
                  difficultyLevel,
                  nodeId: nodeKey(node),
                  selected: !checked,
                }),
              !!draft || ancestorSelected,
            )}
          >
            {isCategory(node) ? (
              <Collapsible
                defaultOpen
                className={cn(
                  "rounded-xl border p-2 sm:p-3",
                  checked ? "border-primary bg-primary/5" : "bg-muted/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <SortableItemHandle
                    render={
                      <Button type="button" variant="ghost" size="icon-sm" disabled={!!draft} />
                    }
                    aria-label={`Переместить категорию "${node.title}"`}
                  >
                    <GripVerticalIcon />
                  </SortableItemHandle>
                  <FolderIcon className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <ExpandableText text={node.title} maxLength={100} className="font-semibold" />
                    <span className="text-xs text-muted-foreground">
                      {formatItemCount(countTaskItems(node.children))}
                    </span>
                  </div>
                  <CollapsibleTrigger
                    render={<Button type="button" variant="ghost" size="icon-sm" />}
                    className="group"
                    aria-label={`Свернуть или раскрыть категорию «${node.title}»`}
                  >
                    <ChevronDownIcon className="transition-transform group-aria-expanded:rotate-180" />
                  </CollapsibleTrigger>
                  {menu}
                </div>
                <CollapsibleContent keepMounted>
                  <div className="mt-3 border-l pl-2 sm:pl-4">
                    <TaskTree
                      nodes={node.children}
                      roots={roots}
                      numbers={numbers}
                      difficultyLevel={difficultyLevel}
                      parentId={nodeKey(node)}
                      selected={selected}
                      ancestorSelected={checked}
                      draft={draft}
                      actions={actions}
                      onRename={onRename}
                    />
                    {!node.children.length && (
                      <p className="p-3 text-sm text-muted-foreground">
                        В категории пока нет пунктов.
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <TaskItemCard
                item={editing ? draft.item : node}
                number={numbers.get(nodeKey(node))!}
                difficultyLevel={difficultyLevel}
                editing={!!editing}
                busy={!!draft}
                actions={actions}
                selected={checked}
                menu={menu}
              />
            )}
          </SortableItem>
        )
      })}
    </Sortable>
  )
}

/** Управляет деревьями трёх сложностей; формы остаются смонтированными при смене вкладок и сворачивании категорий. */
export default function TaskItemsEditor({
  initialItems,
  onChange,
  onEditingChange,
  renderLevelFields,
}: {
  initialItems: TaskNode[]
  onChange?: (nodes: TaskNode[]) => void
  onEditingChange?: (editing: boolean) => void
  renderLevelFields?: (level: TaskDifficultyLevel) => ReactNode
}) {
  const { state, actions } = useTaskItems(initialItems)
  useEffect(() => {
    onChange?.(taskDifficultyLevels.flatMap((level) => state.nodesByDifficultyLevel[level.value]))
  }, [state.nodesByDifficultyLevel, onChange])
  useEffect(() => {
    onEditingChange?.(Object.values(state.draftsByDifficultyLevel).some(Boolean))
  }, [state.draftsByDifficultyLevel, onEditingChange])
  const [naming, setNaming] = useState<{
    categoryId?: string
    title: string
  } | null>(null)
  const difficultyLevel = state.activeDifficultyLevel
  const roots = state.nodesByDifficultyLevel[difficultyLevel]
  const selected = state.selectedByDifficultyLevel[difficultyLevel]

  // При добавлении нового пункта ограничиваем действия
  const busy = !!state.draftsByDifficultyLevel[difficultyLevel]

  const selectionCount = selectedRoots(roots, selected).length
  const canGroup =
    selectionCount > 0 &&
    groupNodes(roots, selected, "__group-preview__", "Категория", difficultyLevel) !== null

  const onRename = (categoryId: string, title: string) => setNaming({ categoryId, title })

  return (
    <SectionLayout>
      <SectionLayoutHeaderRow>
        <SectionLayoutHeader>Пункты задачи</SectionLayoutHeader>
        <SectionLayoutActions>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy || !canGroup}
            onClick={() => setNaming({ title: "Новая категория" })}
          >
            Сгруппировать <GroupIcon />
          </Button>
          <TaskItemLibrary
            difficultyLevel={difficultyLevel}
            disabled={busy}
            onImport={(nodes) => actions.importNodes({ difficultyLevel, nodes })}
          />
          <Button
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => actions.startCreating({ difficultyLevel })}
          >
            Добавить пункт <PlusIcon />
          </Button>
        </SectionLayoutActions>
      </SectionLayoutHeaderRow>
      <SectionLayoutDescription>
        Что конкретно должен выполнить пользователь по списку
      </SectionLayoutDescription>
      {selectionCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span>Выбрано: {selectionCount}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => actions.clearSelection({ difficultyLevel })}
          >
            Снять выделение
          </Button>
          {!canGroup && (
            <span role="status" className="text-destructive">
              Группировка превысит три уровня категорий.
            </span>
          )}
        </div>
      )}
      <SectionLayoutContent>
        <Tabs
          value={difficultyLevel}
          onValueChange={(value) => {
            const level = taskDifficultyLevels.find((entry) => entry.value === value)
            if (level) actions.selectDifficultyLevel({ difficultyLevel: level.value })
          }}
        >
          <div className="max-w-full overflow-x-auto pb-1">
            <TabsList variant="line" aria-label="Сложность пунктов задачи">
              {taskDifficultyLevels.map((level) => (
                <TabsTrigger key={level.value} value={level.value}>
                  {level.label} (
                  {formatItemCount(countTaskItems(state.nodesByDifficultyLevel[level.value]))})
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {taskDifficultyLevels.map((level) => {
            const nodes = state.nodesByDifficultyLevel[level.value]
            const draft = state.draftsByDifficultyLevel[level.value]
            const visibleNodes = draft?.isNew
              ? updateChildren(nodes, draft.parentCategoryId, (children) => [
                  ...children,
                  draft.item,
                ])
              : nodes
            return (
              <TabsContent key={level.value} value={level.value} keepMounted className="py-4">
                {renderLevelFields?.(level.value)}
                <div className="max-h-[min(65vh,48rem)] overflow-y-auto overscroll-contain p-1 scrollbar-gutter-stable border-b">
                  {!visibleNodes.length && (
                    <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                      Пока нет пунктов. Добавьте новый пункт или импортируйте из библиотеки.
                    </p>
                  )}
                  <TaskTree
                    nodes={visibleNodes}
                    roots={nodes}
                    numbers={taskItemNumbers(visibleNodes)}
                    difficultyLevel={level.value}
                    selected={state.selectedByDifficultyLevel[level.value]}
                    draft={draft}
                    actions={actions}
                    onRename={onRename}
                  />
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
        <p className="mt-3 text-sm text-muted-foreground">
          Удерживайте <Kbd>Shift</Kbd> и кликайте по пунктам или категориям, чтобы выделить их.
          Повторный <Kbd>Shift</Kbd> + клик снимает выделение.
        </p>
      </SectionLayoutContent>
      {naming && (
        <TaskCategoryForm
          title={naming.title}
          editing={!!naming.categoryId}
          disabled={busy || (!naming.categoryId && !canGroup)}
          onCancel={() => setNaming(null)}
          onSave={({ title }) => {
            if (busy) return
            if (naming.categoryId)
              actions.renameCategory({ difficultyLevel, categoryId: naming.categoryId, title })
            else if (canGroup) actions.groupSelection({ difficultyLevel, title })
            else return
            setNaming(null)
          }}
        />
      )}
    </SectionLayout>
  )
}
