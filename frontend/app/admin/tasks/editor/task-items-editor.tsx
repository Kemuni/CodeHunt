"use client"

import {ChevronDownIcon, EllipsisIcon, GripVerticalIcon, GroupIcon, ImportIcon, PlusIcon, Trash2Icon} from "lucide-react";
import {Sortable, SortableItem, SortableItemHandle} from "@/components/reui/sortable";
import {Button} from "@/components/ui/button";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  SectionLayout, SectionLayoutActions, SectionLayoutContent, SectionLayoutDescription,
  SectionLayoutHeader, SectionLayoutHeaderRow,
} from "@/components/ui/layouts/section";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {
  formatItemCount, taskDifficultyLevels,
  type TaskDifficultyLevel, type TaskItem,
} from "./task-items-state";
import {useTaskItems, type TaskItemsActions} from "./use-task-items";
import TaskItemForm from "./task-item-form";

interface TaskItemCardProps {
  item: TaskItem;
  index: number;
  difficultyLevel: TaskDifficultyLevel;
  editing: boolean;
  busy: boolean;
  actions: TaskItemsActions;
}

function TaskItemCard({item, index, difficultyLevel, editing, busy, actions}: TaskItemCardProps) {
  const difficultyLevelLabel = taskDifficultyLevels.find((entry) => entry.value === difficultyLevel)?.label;

  return (
    <div className="flex items-start gap-2 rounded-md border p-3 transition-colors hover:bg-background sm:gap-3">
      <SortableItemHandle
        render={<Button type="button" variant="ghost" size="icon-sm" disabled={busy} />}
        aria-label={`Переместить пункт ${index + 1}`}
        className="self-center text-muted-foreground hover:text-foreground"
      >
        <GripVerticalIcon className="size-4" />
      </SortableItemHandle>
      <div className="grid size-9 shrink-0 select-none place-items-center rounded-xl bg-primary/10 text-xl font-semibold text-primary sm:size-16 sm:text-3xl">
        {index + 1}
      </div>
      {editing ? (
        <TaskItemForm
          key={item.id}
          item={item}
          onSave={(values) => actions.saveDraft({difficultyLevel, values})}
          onCancel={() => actions.cancelDraft({difficultyLevel})}
        />
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 text-xl font-semibold wrap-break-word">
              {item.title}
              {!item.required && <span className="ml-2 text-sm font-normal text-muted-foreground">(необязательно)</span>}
            </h3>
            <span className="ml-auto shrink-0 rounded-full bg-dark-green/15 px-2 py-0.5 text-sm font-light text-dark-green">
              {difficultyLevelLabel}
            </span>
          </div>
          <p className="text-base whitespace-pre-wrap wrap-break-word">{item.description}</p>
          <Collapsible>
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" className="hover:bg-primary/5 aria-expanded:bg-primary/5 text-primary!" />}
              className="group w-fit justify-start"
            >
              Критерии проверки
              <ChevronDownIcon aria-hidden="true" className="transition-transform group-aria-expanded:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent keepMounted>
              <p className="mt-1 border-l border-primary bg-primary/5 px-3 py-2 text-sm whitespace-pre-wrap wrap-break-word text-primary">
                {item.criteria}
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
      {editing ? <div className="size-8 shrink-0" /> : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" size="icon-sm" />}
            aria-label={`Действия с пунктом «${item.title}»`}
            disabled={busy}
          >
            <EllipsisIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => actions.startEditing({difficultyLevel, itemId: item.id})}>
              Изменить пункт
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Перенести в…</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {taskDifficultyLevels.filter((target) => target.value !== difficultyLevel).map((target) => (
                  <DropdownMenuItem
                    key={target.value}
                    onClick={() => actions.moveItem({difficultyLevel, targetDifficultyLevel: target.value, itemId: item.id})}
                  >
                    {target.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => actions.deleteItem({difficultyLevel, itemId: item.id})}
            >
              <Trash2Icon aria-hidden="true" />
              Удалить пункт
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default function TaskItemsEditor({initialItems}: {initialItems: TaskItem[]}) {
  const {state, actions} = useTaskItems(initialItems);

  return (
    <SectionLayout>
      <SectionLayoutHeaderRow>
        <SectionLayoutHeader>Пункты задачи</SectionLayoutHeader>
        <SectionLayoutActions>
          <Button type="button" variant="outline" size="lg">Сгруппировать <GroupIcon /></Button>
          <Button type="button" variant="outline" size="lg">Импортировать пункты <ImportIcon /></Button>
          <Button
            type="button"
            size="lg"
            disabled={!!state.draftsByDifficultyLevel[state.activeDifficultyLevel]}
            onClick={() => actions.startCreating({difficultyLevel: state.activeDifficultyLevel})}
          >
            Добавить пункт <PlusIcon />
          </Button>
        </SectionLayoutActions>
      </SectionLayoutHeaderRow>
      <SectionLayoutDescription>Что конкретно должен выполнить пользователь по списку</SectionLayoutDescription>
      <SectionLayoutContent>
        <Tabs
          value={state.activeDifficultyLevel}
          onValueChange={(value) => {
            const difficultyLevel = taskDifficultyLevels.find((entry) => entry.value === value);
            if (difficultyLevel) actions.selectDifficultyLevel({difficultyLevel: difficultyLevel.value});
          }}
        >
          <div className="max-w-full overflow-x-auto pb-1">
            <TabsList variant="line" aria-label="Сложность пунктов задачи">
              {taskDifficultyLevels.map((difficultyLevel) => (
                <TabsTrigger key={difficultyLevel.value} value={difficultyLevel.value}>
                  {difficultyLevel.label} ({formatItemCount(state.itemsByDifficultyLevel[difficultyLevel.value].length)})
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {taskDifficultyLevels.map((difficultyLevel) => {
            const items = state.itemsByDifficultyLevel[difficultyLevel.value];
            const draft = state.draftsByDifficultyLevel[difficultyLevel.value];
            const visibleItems = draft?.isNew ? [...items, draft.item] : items;

            return (
              <TabsContent key={difficultyLevel.value} value={difficultyLevel.value} keepMounted>
                {!visibleItems.length && (
                  <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                    Пока нет пунктов. Добавьте новый пункт или перенесите его из другой сложности.
                  </p>
                )}
                <Sortable
                  value={visibleItems}
                  onValueChange={(items) => actions.reorderItems({difficultyLevel: difficultyLevel.value, items})}
                  getItemValue={(item) => item.id}
                  strategy="vertical"
                  className="space-y-2"
                >
                  {visibleItems.map((item, index) => {
                    const editing = draft?.item.id === item.id;
                    return (
                      <SortableItem key={item.id} value={item.id} disabled={!!draft} className="data-disabled:opacity-100">
                        <TaskItemCard
                          item={editing ? draft.item : item}
                          index={index}
                          difficultyLevel={difficultyLevel.value}
                          editing={editing}
                          busy={!!draft}
                          actions={actions}
                        />
                      </SortableItem>
                    );
                  })}
                </Sortable>
              </TabsContent>
            );
          })}
        </Tabs>
      </SectionLayoutContent>
    </SectionLayout>
  );
}
