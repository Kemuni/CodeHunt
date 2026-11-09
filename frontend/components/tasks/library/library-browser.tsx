"use client"

import type { ReactNode } from "react"
import { ChevronDownIcon } from "lucide-react"
import type {
  CategoryLibrary,
  DeveloperLibrary,
  DeveloperType,
  TemplateRead,
} from "@/lib/api/task-contract"
import { developerTypeLabels } from "@/lib/tasks/labels"
import { libraryTemplates } from "@/lib/tasks/task-library"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ExpandableText from "@/components/tasks/expandable-text"

interface LibraryTreeProps {
  categories: CategoryLibrary[]
  selection?: { selected: Set<number>; toggle: (ids: number[], checked: boolean) => void }
  categoryActions?: (category: CategoryLibrary) => ReactNode
  templateActions?: (template: TemplateRead) => ReactNode
}

function LibrarySelection({
  ids,
  label,
  selection,
}: {
  ids: number[]
  label: string
  selection: NonNullable<LibraryTreeProps["selection"]>
}) {
  const count = ids.filter((id) => selection.selected.has(id)).length
  return (
    <Checkbox
      aria-label={label}
      disabled={!ids.length}
      checked={ids.length > 0 && count === ids.length}
      indeterminate={count > 0 && count < ids.length}
      onCheckedChange={(checked) => selection.toggle(ids, checked)}
    />
  )
}

/** Одно дерево для управления библиотекой и выбора пунктов в редакторе. */
function LibraryTree({
  categories,
  selection,
  categoryActions,
  templateActions,
}: LibraryTreeProps) {
  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <Collapsible key={category.id} defaultOpen className="min-w-0 rounded-lg border p-2 sm:p-3">
          <div className="flex flex-wrap items-center gap-2">
            {selection && (
              <LibrarySelection
                ids={libraryTemplates([category]).map((item) => item.id)}
                label={`Выбрать категорию «${category.title}»`}
                selection={selection}
              />
            )}
            <span className="min-w-0 flex-1 basis-24 font-medium wrap-anywhere">
              {category.title}
            </span>
            {categoryActions?.(category)}
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" size="icon-sm" />}
              className="group"
              aria-label={`Свернуть или раскрыть категорию «${category.title}»`}
            >
              <ChevronDownIcon className="transition-transform group-aria-expanded:rotate-180" />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-2 pt-3 sm:pl-3">
            {(category.complications ?? []).map((template) => (
              <div
                key={template.id}
                className="flex flex-wrap items-start gap-2 rounded-lg border p-3"
              >
                {selection && (
                  <LibrarySelection
                    ids={[template.id]}
                    label={`Выбрать пункт «${template.title}»`}
                    selection={selection}
                  />
                )}
                <div className="min-w-0 flex-1 basis-32">
                  <h3 className="font-medium wrap-anywhere">{template.title}</h3>
                  <ExpandableText
                    text={template.description}
                    maxLength={180}
                    className="mt-1 text-sm text-muted-foreground"
                  />
                </div>
                {templateActions?.(template)}
              </div>
            ))}
            <LibraryTree
              categories={category.children ?? []}
              selection={selection}
              categoryActions={categoryActions}
              templateActions={templateActions}
            />
            {!category.complications?.length && !category.children?.length && (
              <p className="text-sm text-muted-foreground">В категории пока нет пунктов.</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}

export default function LibraryBrowser({
  data,
  pending,
  error,
  onRetry,
  direction,
  onDirectionChange,
  ...treeProps
}: Omit<LibraryTreeProps, "categories"> & {
  data?: DeveloperLibrary[]
  pending: boolean
  error: Error | null
  onRetry: () => void
  direction: DeveloperType
  onDirectionChange: (value: DeveloperType) => void
}) {
  if (pending) return <p role="status">Загружаем библиотеку…</p>
  if (error)
    return (
      <div role="alert" className="space-y-3">
        <p className="text-destructive">{error.message}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Повторить загрузку
        </Button>
      </div>
    )

  return (
    <Tabs
      value={direction}
      onValueChange={(value) => {
        if (value === "frontend" || value === "fullstack") onDirectionChange(value)
      }}
    >
      <TabsList variant="line">
        {Object.entries(developerTypeLabels).map(([value, label]) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {Object.entries(developerTypeLabels).map(([value]) => {
        const categories =
          data?.find((section) => section.developer_type === value)?.categories ?? []
        return (
          <TabsContent key={value} value={value} className="pt-2">
            {categories.length ? (
              <LibraryTree categories={categories} {...treeProps} />
            ) : (
              <p className="py-6 text-center text-muted-foreground">
                В этом направлении пока нет категорий.
              </p>
            )}
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
