"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { tasksApi } from "@/lib/api/tasks"
import type { ComplicationItem, ComplicationGroupRead } from "@/lib/api/task-contract"
import { levelLabels } from "@/lib/tasks/labels"
import { PageLayout, PageLayoutContent, PageLayoutHeader } from "@/components/ui/layouts/page"
import {
  SectionLayout,
  SectionLayoutHeader,
  SectionLayoutContent,
} from "@/components/ui/layouts/section"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import ExpandableText from "@/components/tasks/expandable-text"

/** Рекурсивно показывает группы и пункты из готовой конфигурации API; состояние редактора не использует. */
function Requirements({ nodes }: { nodes: Array<ComplicationItem | ComplicationGroupRead> }) {
  return (
    <div className="space-y-3">
      {nodes.map((node) =>
        node.kind === "group" ? (
          <Collapsible key={`group-${node.id}`} defaultOpen className="rounded-xl border p-4">
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" />}
              className="max-w-full whitespace-normal text-left"
            >
              {node.title}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 border-l pl-3">
              <Requirements nodes={node.items ?? []} />
            </CollapsibleContent>
          </Collapsible>
        ) : "description" in node ? (
          <article key={`item-${node.id}`} className="rounded-xl border p-4">
            <h3 className="font-semibold">
              {node.title}
              {!node.is_required && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (необязательно)
                </span>
              )}
            </h3>
            <ExpandableText text={node.description} className="mt-2 text-sm" />
            <h4 className="mt-3 text-sm font-medium">Критерии проверки</h4>
            <ExpandableText
              text={node.acceptance_criteria}
              className="text-sm text-muted-foreground"
            />
          </article>
        ) : null,
      )}
    </div>
  )
}

/** React Query загружает задачу и состав выбранного уровня, включая пункты более простых уровней. */
export default function TaskDetails({ id }: { id: number }) {
  const taskQuery = useQuery({
    queryKey: ["public-task", id],
    queryFn: () => tasksApi.task(id, false),
    retry: false,
  })
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const task = taskQuery.data
  const presetId = selectedPreset ?? task?.presets[0]?.id
  const config = useQuery({
    queryKey: ["public-configuration", id, presetId],
    queryFn: () => tasksApi.configuration(id, presetId!),
    enabled: !!presetId,
    retry: false,
  })
  const download = async (resourceId: number) => {
    try {
      const result = await tasksApi.resourceUrl("task", id, resourceId, false)
      const a = document.createElement("a")
      a.href = result.url
      a.download = ""
      a.click()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось получить файл")
    }
  }
  if (taskQuery.isPending)
    return (
      <PageLayout>
        <p role="status">Загружаем задачу…</p>
      </PageLayout>
    )
  if (!task)
    return (
      <PageLayout>
        <p role="alert">{taskQuery.error?.message ?? "Задача не найдена"}</p>
        <Button onClick={() => void taskQuery.refetch()}>Повторить</Button>
      </PageLayout>
    )
  return (
    <PageLayout>
      <Link href="/tasks" className="mb-4 text-sm text-primary underline">
        Все задачи
      </Link>
      <PageLayoutHeader>{task.title}</PageLayoutHeader>
      <PageLayoutContent>
        <SectionLayout>
          <SectionLayoutHeader>
            {task.developer_type === "frontend" ? "Фронтенд" : "Фуллстек"} · Сложность{" "}
            {task.difficulty_from}–{task.difficulty_to}
          </SectionLayoutHeader>
          <SectionLayoutContent>
            <p className="whitespace-pre-wrap wrap-anywhere">{task.full_description}</p>
            {task.design_author_name && (
              <p className="mt-4 text-sm">
                Автор дизайна:{" "}
                {task.design_author_link && /^https?:\/\//.test(task.design_author_link) ? (
                  <a
                    href={task.design_author_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {task.design_author_name}
                  </a>
                ) : (
                  task.design_author_name
                )}
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {task.photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block aspect-video overflow-hidden rounded-xl"
                >
                  <Image
                    src={photo.url}
                    alt={photo.original_filename}
                    fill
                    unoptimized
                    className="object-contain"
                    sizes="(min-width: 640px) 50vw, 100vw"
                  />
                </a>
              ))}
            </div>
          </SectionLayoutContent>
        </SectionLayout>
        <SectionLayout>
          <SectionLayoutHeader>Пункты задачи</SectionLayoutHeader>
          <SectionLayoutContent>
            <Tabs
              value={String(presetId ?? "")}
              onValueChange={(value) => setSelectedPreset(Number(value))}
            >
              <TabsList>
                {task.presets.map((preset) => (
                  <TabsTrigger key={preset.id} value={String(preset.id)}>
                    {levelLabels[preset.level]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {config.isPending && presetId ? (
              <p className="mt-4">Загружаем пункты…</p>
            ) : config.error ? (
              <div role="alert">
                <p>{config.error.message}</p>
                <Button variant="outline" onClick={() => void config.refetch()}>
                  Повторить
                </Button>
              </div>
            ) : (
              <>
                {config.data && (
                  <div className="my-4">
                    <p className="whitespace-pre-wrap">{config.data.preset.description}</p>
                    {config.data.preset.average_days_to_complete && (
                      <p className="text-sm text-muted-foreground">
                        Среднее время выполнения: {config.data.preset.average_days_to_complete} дн.
                      </p>
                    )}
                  </div>
                )}
                <Requirements nodes={config.data?.complications ?? task.complications} />
              </>
            )}
          </SectionLayoutContent>
        </SectionLayout>
        {!!task.resources.length && (
          <SectionLayout>
            <SectionLayoutHeader>Вложения</SectionLayoutHeader>
            <SectionLayoutContent>
              <ul className="space-y-2">
                {task.resources.map((resource) => (
                  <li key={resource.id}>
                    <Button variant="link" onClick={() => void download(resource.id)}>
                      {resource.title}
                    </Button>
                  </li>
                ))}
              </ul>
            </SectionLayoutContent>
          </SectionLayout>
        )}
      </PageLayoutContent>
    </PageLayout>
  )
}
