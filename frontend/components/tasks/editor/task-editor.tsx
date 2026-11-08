"use client"

import { PageLayout, PageLayoutContent, PageLayoutHeader } from "@/components/ui/layouts/page"
import {
  SectionLayout,
  SectionLayoutContent,
  SectionLayoutDescription,
  SectionLayoutHeader,
} from "@/components/ui/layouts/section"
import { Button } from "@/components/ui/button"
import { TaskResources } from "@/components/tasks/task-resources"
import { ValidationIssues } from "@/components/tasks/validation-issues"
import TaskItemsEditor from "@/components/tasks/editor/items/task-items-editor"
import TaskInfoFields from "./task-info-fields"
import TaskLevelFields from "@/components/tasks/editor/items/task-level-fields"
import Form from "@/components/ui/form/form"
import { GalleryUpload } from "@/components/ui/form/gallery-upload"
import { toast } from "sonner"
import { useTaskEditor, type TaskEditorProps } from "@/hooks/tasks/use-task-editor"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

/** Собирает секции редактора; запросы, автосохранение и состояние операций находятся в useTaskEditor. */
export default function TaskEditor({ mode, initial }: TaskEditorProps) {
  const {
    initialInfo,
    schema,
    tree,
    treeVersion,
    photos,
    resources,
    saving,
    itemEditing,
    draftSnapshot,
    status,
    issues,
    saveDisabled,
    mediaDisabled,
    onInfoChange,
    onNodesChange,
    setItemEditing,
    saveTask,
    retrySave,
    uploadPhotos,
    removePhoto,
    coverPhoto,
    clearPhotos,
    uploadResources,
    removeResource,
    downloadResource,
  } = useTaskEditor({ mode, initial })
  return (
    <Form
      id="task-info"
      detached
      schema={schema}
      defaultValues={initialInfo}
      onValuesChange={onInfoChange}
      onSubmit={saveTask}
      onInvalid={() => toast.error("Проверьте обязательные поля задачи")}
    >
      <PageLayout>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageLayoutHeader backHref="/admin/tasks">
            {mode.kind === "task" ? "Редактирование задачи" : "Новая задача"}
          </PageLayoutHeader>
        </div>
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {status}
        </p>
        {itemEditing && (
          <p className="mt-2 text-sm text-muted-foreground">
            Сохраните или отмените редактируемый пункт перед сохранением задачи.
          </p>
        )}
        {draftSnapshot.error && (
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={draftSnapshot.pending > 0}
              onClick={retrySave}
            >
              {draftSnapshot.conflict
                ? "Загрузить версию с сервера (локальные правки будут потеряны)"
                : "Повторить сохранение"}
            </Button>
          </div>
        )}
        <ValidationIssues issues={issues} />
        <fieldset disabled={saving} className="min-w-0">
          <PageLayoutContent className="mt-4">
            <SectionLayout>
              <SectionLayoutHeader>Основная информация</SectionLayoutHeader>
              <SectionLayoutDescription>
                То, что пользователь видит в первой карточке товара
              </SectionLayoutDescription>
              <SectionLayoutContent>
                <TaskInfoFields>
                  <GalleryUpload
                    files={photos.map((photo) => ({
                      id: photo.id,
                      name: photo.original_filename,
                      size: photo.size_bytes,
                      url: photo.url,
                      isCover: photo.is_cover,
                    }))}
                    busy={mediaDisabled}
                    onUpload={uploadPhotos}
                    onRemove={removePhoto}
                    onCover={coverPhoto}
                    onClear={clearPhotos}
                  />
                  <p className="text-sm text-muted-foreground">
                    {mode.kind === "task"
                      ? "Фото сохраняются сразу, независимо от кнопки сохранения задачи."
                      : "Фото прикрепляются к черновику сразу."}
                  </p>
                </TaskInfoFields>
              </SectionLayoutContent>
            </SectionLayout>
            <TaskItemsEditor
              key={treeVersion}
              initialItems={tree}
              onChange={onNodesChange}
              onEditingChange={setItemEditing}
              renderLevelFields={(difficultyLevel) => (
                <TaskLevelFields difficultyLevel={difficultyLevel} />
              )}
            />
            <SectionLayout>
              <SectionLayoutHeader>Вложения</SectionLayoutHeader>
              <SectionLayoutDescription>
                Файлы и материалы для выполнения задачи
              </SectionLayoutDescription>
              <SectionLayoutContent>
                <TaskResources
                  resources={resources}
                  busy={mediaDisabled}
                  onUpload={uploadResources}
                  onRemove={removeResource}
                  onDownload={downloadResource}
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  {mode.kind === "task"
                    ? "Файлы сохраняются и удаляются сразу, независимо от кнопки сохранения задачи."
                    : "Файлы прикрепляются к черновику сразу."}
                </p>
              </SectionLayoutContent>
            </SectionLayout>
          </PageLayoutContent>
        </fieldset>
        <div className="w-fit float-end ml-auto mt-6">
          <Button size="lg" type="submit" form="task-info" disabled={saveDisabled}>
            {saving ? "Сохраняем…" : "Сохранить задачу"}
          </Button>
        </div>
      </PageLayout>
    </Form>
  )
}
