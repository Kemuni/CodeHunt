"use client"

import type { TaskLevel } from "@/lib/tasks/task-level"
import { ArrowDownIcon, ArrowUpIcon, EllipsisIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { taskDifficultyLevels } from "@/lib/tasks/task-items-state"
import {
  canRelocate,
  categoryDestinations,
  isCategory,
  nodePath,
  nodeKey,
  type TaskNode,
} from "@/lib/tasks/task-tree"
import type { TaskItemsActions } from "@/hooks/tasks/use-task-items"

interface TaskNodeMenuProps {
  node: TaskNode
  roots: TaskNode[]
  difficultyLevel: TaskLevel
  index: number
  total: number
  parentId: string | null
  disabled: boolean
  actions: TaskItemsActions
  onRename: (id: string, title: string) => void
}

/** Действия над пунктом или целой категорией; переносы проверяют глубину и исключают циклы дерева. */
export default function TaskNodeMenu({
  node,
  roots,
  difficultyLevel,
  index,
  total,
  parentId,
  disabled,
  actions,
  onRename,
}: TaskNodeMenuProps) {
  const category = isCategory(node)
  const destinations = categoryDestinations(roots).filter((target) =>
    canRelocate(roots, nodeKey(node), target.id),
  )
  const upperParentId = parentId ? (nodePath(roots, parentId)?.at(-2) ?? null) : null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="ghost" size="icon-sm" />}
        aria-label={`Действия: ${node.title}`}
        disabled={disabled}
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            category
              ? onRename(nodeKey(node), node.title)
              : actions.startEditing({ difficultyLevel, itemId: nodeKey(node) })
          }
        >
          {category ? "Переименовать категорию" : "Изменить пункт"}
        </DropdownMenuItem>
        {category && (
          <DropdownMenuItem
            onClick={() =>
              actions.startCreating({ difficultyLevel, parentCategoryId: nodeKey(node) })
            }
          >
            Добавить пункт в категорию
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={index === 0}
          onClick={() =>
            actions.movePosition({ difficultyLevel, nodeId: nodeKey(node), direction: "up" })
          }
        >
          <ArrowUpIcon />
          Вверх
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={index === total - 1}
          onClick={() =>
            actions.movePosition({ difficultyLevel, nodeId: nodeKey(node), direction: "down" })
          }
        >
          <ArrowDownIcon />
          Вниз
        </DropdownMenuItem>
        {parentId && (
          <DropdownMenuItem
            onClick={() =>
              actions.relocateNode({
                difficultyLevel,
                nodeId: nodeKey(node),
                parentCategoryId: upperParentId,
              })
            }
          >
            На уровень выше
          </DropdownMenuItem>
        )}
        {(parentId || destinations.length > 0) && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Перенести в категорию…</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-w-[80vw]">
              {parentId && (
                <DropdownMenuItem
                  onClick={() =>
                    actions.relocateNode({
                      difficultyLevel,
                      nodeId: nodeKey(node),
                      parentCategoryId: null,
                    })
                  }
                >
                  Без категории
                </DropdownMenuItem>
              )}
              {destinations.map((target) => (
                <DropdownMenuItem
                  key={target.id}
                  className="whitespace-normal"
                  onClick={() =>
                    actions.relocateNode({
                      difficultyLevel,
                      nodeId: nodeKey(node),
                      parentCategoryId: target.id,
                    })
                  }
                >
                  {target.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Перенести в сложность…</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {taskDifficultyLevels
              .filter((level) => level.value !== difficultyLevel)
              .map((level) => (
                <DropdownMenuItem
                  key={level.value}
                  onClick={() =>
                    actions.moveNode({
                      difficultyLevel,
                      targetDifficultyLevel: level.value,
                      nodeId: nodeKey(node),
                    })
                  }
                >
                  {level.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {category ? (
          <DropdownMenuItem
            onClick={() => actions.ungroup({ difficultyLevel, categoryId: nodeKey(node) })}
          >
            Разгруппировать
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => actions.deleteItem({ difficultyLevel, itemId: nodeKey(node) })}
          >
            <Trash2Icon />
            Удалить пункт
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
