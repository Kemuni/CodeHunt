"use client"

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
import { taskDifficultyLevels, type TaskDifficultyLevel } from "./task-items-state"
import { canRelocate, categoryDestinations, isCategory, nodePath, type TaskNode } from "./task-tree"
import type { TaskItemsActions } from "./use-task-items"

interface TaskNodeMenuProps {
  node: TaskNode
  roots: TaskNode[]
  difficultyLevel: TaskDifficultyLevel
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
    canRelocate(roots, node.id, target.id),
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
              ? onRename(node.id, node.title)
              : actions.startEditing({ difficultyLevel, itemId: node.id })
          }
        >
          {category ? "Переименовать категорию" : "Изменить пункт"}
        </DropdownMenuItem>
        {category && (
          <DropdownMenuItem
            onClick={() => actions.startCreating({ difficultyLevel, parentCategoryId: node.id })}
          >
            Добавить пункт в категорию
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={index === 0}
          onClick={() =>
            actions.movePosition({ difficultyLevel, nodeId: node.id, direction: "up" })
          }
        >
          <ArrowUpIcon />
          Вверх
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={index === total - 1}
          onClick={() =>
            actions.movePosition({ difficultyLevel, nodeId: node.id, direction: "down" })
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
                nodeId: node.id,
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
                      nodeId: node.id,
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
                      nodeId: node.id,
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
                      nodeId: node.id,
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
            onClick={() => actions.ungroup({ difficultyLevel, categoryId: node.id })}
          >
            Разгруппировать
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => actions.deleteItem({ difficultyLevel, itemId: node.id })}
          >
            <Trash2Icon />
            Удалить пункт
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
