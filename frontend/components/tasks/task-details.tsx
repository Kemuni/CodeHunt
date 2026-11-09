"use client"

import { taskPhotoUrl } from "@/lib/api/task-media"
import { downloadFile } from "@/lib/tasks/download-file"

import { TaskLevel } from "@/lib/tasks/task-level"
import { useId, useState } from "react"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  BookmarkIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileArchiveIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  ImageIcon,
  LoaderCircleIcon,
  PaperclipIcon,
} from "lucide-react"
import { tasksApi } from "@/lib/api/tasks"
import type {
  ComplicationItem,
  ComplicationGroupRead,
  PhotoRead,
  ResourceRead,
  TaskDetail,
  TaskPresetRead,
} from "@/lib/api/task-contract"
import { developerTypeLabels, levelLabels } from "@/lib/tasks/labels"
import { formatBytes } from "@/lib/hooks/use-file-upload"
import { PageLayout, PageLayoutContent, PageLayoutHeader } from "@/components/ui/layouts/page"
import {
  SectionLayout,
  SectionLayoutHeader,
  SectionLayoutContent,
} from "@/components/ui/layouts/section"
import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import TaskRequirementGroup from "@/components/tasks/task-requirement-group"
import ResponsiveModal from "@/components/ui/responsive-modal"
import TaskRequirementCard from "@/components/tasks/task-requirement-card"
import TaskDifficulty from "@/components/tasks/task-difficulty"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/reui/badge"
import DoubleSlash from "../icons/double-slash"
import React from "react"

const previewLimit = 4

type PreviewRequirement =
  | { kind: "item"; node: ComplicationItem; previewIndex: number }
  | {
      kind: "group"
      node: ComplicationGroupRead
      previewIndex: number
      count: number
      items: PreviewRequirement[]
    }

/** Считает размер и границы превью; видимые номера берёт из ответа backend. */
function previewRequirements(nodes: TaskPresetRead["complications"]) {
  let count = 0
  const walk = (nodes: TaskPresetRead["complications"]): PreviewRequirement[] =>
    nodes.map((node) => {
      if ("description" in node) return { kind: "item", node, previewIndex: ++count }
      const previewIndex = count + 1
      const items = walk(node.items ?? [])
      return { kind: "group", node, previewIndex, count: count - previewIndex + 1, items }
    })
  const items = walk(nodes)
  return { items, count }
}

function Requirements({ nodes, limit }: { nodes: PreviewRequirement[]; limit: number }) {
  return (
    <div className="space-y-3">
      {nodes.map((entry) => {
        if (entry.previewIndex > limit) return null
        const { node } = entry
        if (entry.kind === "group")
          return (
            <TaskRequirementGroup key={`group-${node.id}`} title={node.title} count={entry.count}>
              {entry.items.length ? <Requirements nodes={entry.items} limit={limit} /> : null}
            </TaskRequirementGroup>
          )
        return <RequirementItem key={`item-${node.id}`} item={entry.node} />
      })}
    </div>
  )
}

function RequirementItem({ item }: { item: ComplicationItem }) {
  return (
    <TaskRequirementCard
      number={item.order_number}
      level={item.level}
      item={{
        title: item.title,
        description: item.description,
        criteria: item.acceptance_criteria,
        required: item.is_required !== false,
      }}
    />
  )
}

function FunctionalitySection({ level, data }: { level: TaskLevel; data: TaskPresetRead }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const titleId = useId()
  const { items, count } = previewRequirements(data.complications)

  if (!data.preset) return null
  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-1">
      <h3 className="font-heading font-medium text-2xl text-primary inline-flex flex-wrap gap-2 items-baseline">
        <span id={titleId}>{levelLabels[level]} функционал</span>
        {data.preset.average_days_to_complete != null && (
          <span className="font-sans font-light text-xs text-muted-foreground">
            (Время выполнения: ~{data.preset.average_days_to_complete} дн.)
          </span>
        )}
      </h3>
      <p className="whitespace-pre-wrap wrap-anywhere mb-4">{data.preset.description}</p>
      <div className="flex flex-col gap-4">
        <div id={contentId}>
          {items.length ? (
            <Requirements
              nodes={items}
              limit={expanded || count <= previewLimit ? Infinity : previewLimit}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Пункты пока не добавлены.</p>
          )}
        </div>
        {count > previewLimit && (
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-9 w-full whitespace-normal"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Свернуть пункты" : `Показать все ${count} пунктов`}
            <ChevronDownIcon aria-hidden="true" className={expanded ? "rotate-180" : ""} />
          </Button>
        )}
      </div>
    </section>
  )
}

function TaskPhotoCarousel({ photos, title }: { photos: PhotoRead[]; title: string }) {
  const [selectedImage, setSelectedImage] = useState<PhotoRead | null>(null)

  if (!photos.length)
    return (
      <div className="flex aspect-16/10 items-center justify-center gap-3 rounded-2xl border bg-muted/40 text-muted-foreground">
        <ImageIcon aria-hidden="true" />
        <p>Фотографии пока не добавлены</p>
      </div>
    )
  return (
    <>
      <Carousel
        aria-label="Фотографии задачи"
        className="relative w-full overflow-hidden rounded-xl"
      >
        {photos.length > 1 && (
          <CarouselPrevious
            type="button"
            aria-label="Предыдущее фото"
            className="absolute left-3 z-11 opacity-50 hover:opacity-100 disabled:opacity-0"
          />
        )}
        <CarouselContent className="z-10">
          {photos.map((photo, index) => (
            <CarouselItem
              key={photo.id}
              aria-label={`Открыть фото ${index + 1} из ${photos.length}`}
              onClick={() => setSelectedImage(photo)}
            >
              <div className="relative block w-full aspect-16/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                <Image
                  src={taskPhotoUrl(photo)}
                  alt={`${title} — фото ${index + 1}`}
                  fill
                  loading="eager"
                  unoptimized
                  className="object-cover"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {photos.length > 1 && (
          <CarouselNext
            type="button"
            aria-label="Следующее фото"
            className="absolute right-3 z-11 opacity-50 hover:opacity-100 disabled:opacity-0"
          />
        )}
      </Carousel>
      <Dialog
        open={!!selectedImage}
        onOpenChange={(open) => {
          if (!open) setSelectedImage(null)
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Предпросмотр изображения</DialogTitle>
          </DialogHeader>
          <div className="relative h-[min(70dvh,35rem)]">
            {selectedImage && (
              <>
                <Image
                  src={taskPhotoUrl(selectedImage)}
                  alt={selectedImage.original_filename}
                  fill
                  unoptimized
                  sizes="(min-width: 640px) 36rem, 100vw"
                  className="rounded-lg object-contain"
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TaskOverview({ task }: { task: TaskDetail }) {
  return (
    <SectionLayout className="flex sm:h-full flex-col justify-between gap-6 sm:gap-0">
      <div className="flex flex-col gap-3">
        <span className="flex gap-2">
          <Badge variant="free" size="xl">
            Бесплатно
          </Badge>
          <Badge variant={task.developer_type} size="xl">
            {developerTypeLabels[task.developer_type]}
          </Badge>
        </span>
        <h1 className="font-heading text-3xl font-medium wrap-anywhere sm:text-4xl">
          {task.title}
        </h1>
        <p className="whitespace-pre-wrap wrap-anywhere text-muted-foreground">
          {task.short_description}
        </p>
        <TaskDifficulty from={task.difficulty_from} to={task.difficulty_to} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Button
            variant="default"
            size="lg"
            onClick={() => {
              toast.message("Пока не реализовано")
            }}
          >
            Начать выполнение
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              toast.message("Пока не реализовано")
            }}
          >
            <BookmarkIcon />
          </Button>
        </div>
        {task.design_author_name && (
          <span className="text-xs text-muted-foreground">
            Автором дизайна является{" "}
            {task.design_author_link ? (
              <a
                href={task.design_author_link}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {task.design_author_name}
              </a>
            ) : (
              task.design_author_name
            )}
          </span>
        )}
      </div>
    </SectionLayout>
  )
}

function AttachmentIcon({ file }: { file: ResourceRead }) {
  const props = { "aria-hidden": true as const, className: "size-6 shrink-0 text-primary" }
  const name = file.original_filename.toLowerCase()
  if (file.content_type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|fig|psd)$/.test(name))
    return <FileImageIcon {...props} />
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return <FileArchiveIcon {...props} />
  if (/\.(json|html|css|js|ts|tsx|jsx|py|sql)$/.test(name)) return <FileCodeIcon {...props} />
  if (file.content_type?.startsWith("text/") || /\.(pdf|docx?|txt|md)$/.test(name))
    return <FileTextIcon {...props} />
  return <FileIcon {...props} />
}

function Attachment({ taskId, file }: { taskId: number; file: ResourceRead }) {
  const [pending, setPending] = useState(false)
  const download = async () => {
    if (pending) return
    setPending(true)
    try {
      const { url } = await tasksApi.resourceUrl("task", taskId, file.id, false)
      await downloadFile(url, file.original_filename)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось скачать файл")
    } finally {
      setPending(false)
    }
  }
  return (
    <li className="flex items-center gap-3 rounded-xl border p-3">
      <AttachmentIcon file={file} />
      <div className="min-w-0 flex-1">
        <p className="font-medium wrap-anywhere">{file.title}</p>
        <p className="text-xs wrap-anywhere text-muted-foreground">
          {file.original_filename}
          {file.size_bytes != null && ` · ${formatBytes(file.size_bytes)}`}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={pending}
        aria-label={`Скачать ${file.title}`}
        onClick={() => void download()}
      >
        {pending ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
      </Button>
    </li>
  )
}

function TaskSpecification({ task }: { task: TaskDetail }) {
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const titleId = useId()

  return (
    <SectionLayout role="region" aria-labelledby={titleId} className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionLayoutHeader id={titleId} className="min-w-0 flex-1 text-2xl sm:text-3xl">
          Техническое задание
        </SectionLayoutHeader>
        <ResponsiveModal
          open={attachmentsOpen}
          onOpenChange={setAttachmentsOpen}
          title="Вложения к задаче"
          description="Файлы и материалы для выполнения задания."
          trigger={
            <Button type="button" variant="outline" className="ml-auto">
              <PaperclipIcon aria-hidden="true" />
              Вложения
            </Button>
          }
        >
          {task.resources.length ? (
            <ul className="space-y-3">
              {task.resources.map((file) => (
                <Attachment key={file.id} taskId={task.id} file={file} />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-muted-foreground">
              К задаче пока не прикреплены файлы.
            </p>
          )}
        </ResponsiveModal>
      </div>
      <SectionLayoutContent className="gap-12">
        <p className="whitespace-pre-wrap wrap-anywhere leading-relaxed">{task.full_description}</p>
        {Object.values(TaskLevel).map((level, index) => (
          <React.Fragment key={level}>
            <FunctionalitySection level={level} data={task.presets[level]} />
            {Object.values(TaskLevel)[index + 1] &&
              task.presets[Object.values(TaskLevel)[index + 1]].preset && (
                <div className="inline-flex items-center gap-4 opacity-25">
                  <div className="w-full h-px border border-primary-pink" />
                  <DoubleSlash />
                  <div className="w-full h-px border border-primary-pink" />
                </div>
              )}
          </React.Fragment>
        ))}
      </SectionLayoutContent>
    </SectionLayout>
  )
}

function TaskDetailsContent({ task }: { task: TaskDetail }) {
  return (
    <PageLayoutContent className="mt-6 min-h-0">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <TaskPhotoCarousel photos={task.photos} title={task.title} />
        <TaskOverview task={task} />
      </div>
      <TaskSpecification task={task} />
    </PageLayoutContent>
  )
}

export default function TaskDetails({ id }: { id: number }) {
  const taskQuery = useQuery({
    queryKey: ["public-task", id],
    queryFn: () => tasksApi.task(id, false),
    retry: false,
  })
  if (taskQuery.isPending)
    return (
      <PageLayout>
        <p role="status">Загружаем задачу…</p>
      </PageLayout>
    )
  if (!taskQuery.data)
    return (
      <PageLayout>
        <p role="alert">{taskQuery.error?.message ?? "Задача не найдена"}</p>
        <Button onClick={() => void taskQuery.refetch()}>Повторить</Button>
      </PageLayout>
    )
  return (
    <PageLayout>
      <PageLayoutHeader text="Обзор задачи" backHref="/tasks" />
      <TaskDetailsContent key={id} task={taskQuery.data} />
    </PageLayout>
  )
}
