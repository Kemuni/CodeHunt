import {
  deleteApiEditorTasksTaskIdResourcesResourceIdDelete,
  deleteResourceApiEditorTaskDraftsDraftIdResourcesResourceIdDelete,
  updateApiEditorTasksTaskIdResourcesResourceIdPatch,
  updateGalleryApiEditorTasksTaskIdPhotosPut,
  updatePhotosApiEditorTaskDraftsDraftIdPhotosPut,
  updateResourceApiEditorTaskDraftsDraftIdResourcesResourceIdPatch,
  uploadApiEditorTasksTaskIdResourcesPost,
  uploadPhotosApiEditorTaskDraftsDraftIdPhotosPost,
  uploadPhotosApiEditorTasksTaskIdPhotosPost,
  uploadResourceApiEditorTaskDraftsDraftIdResourcesPost,
} from "./generated/sdk.gen"
import { apiData, apiVoid } from "./request"
import type { DraftRead, PhotoRead, ResourceRead } from "./task-contract"

/** Скачивание файлов и показ фотографий используют общий прокси с проверкой доступа. */
export function taskMediaUrl(url: string): string {
  return /^\/api\/media\/(photos|resources)\/\d+$/.test(url)
    ? `/api/backend/${url.slice("/api/".length)}`
    : url
}

/** Каждая операция требует revision и возвращает весь черновик с новой ревизией и ошибками валидации. */
export const draftMediaApi = {
  uploadPhotos: (id: number, revision: number, files: File[]) =>
    apiData(
      uploadPhotosApiEditorTaskDraftsDraftIdPhotosPost({
        path: { draft_id: id },
        body: { revision, files },
      }),
    ) as Promise<DraftRead>,
  setPhotos: (id: number, revision: number, photoIds: number[]) =>
    apiData(
      updatePhotosApiEditorTaskDraftsDraftIdPhotosPut({
        path: { draft_id: id },
        body: { photo_ids: photoIds, revision },
      }),
    ) as Promise<DraftRead>,
  uploadResource: (id: number, revision: number, file: File) =>
    apiData(
      uploadResourceApiEditorTaskDraftsDraftIdResourcesPost({
        path: { draft_id: id },
        body: { file, revision, title: file.name, type: "other" },
      }),
    ) as Promise<DraftRead>,
  updateResource: (id: number, revision: number, resourceId: number, title: string) =>
    apiData(
      updateResourceApiEditorTaskDraftsDraftIdResourcesResourceIdPatch({
        path: { draft_id: id, resource_id: resourceId },
        body: { revision, title },
      }),
    ) as Promise<DraftRead>,
  deleteResource: (id: number, revision: number, resourceId: number) =>
    apiData(
      deleteResourceApiEditorTaskDraftsDraftIdResourcesResourceIdDelete({
        path: { draft_id: id, resource_id: resourceId },
        query: { revision },
      }),
    ) as Promise<DraftRead>,
}

/** Вложения готовой задачи меняются сразу. Тип ответа зависит от операции, revision здесь нет. */
export const taskMediaApi = {
  uploadPhotos: (id: number, files: File[]) =>
    apiData(
      uploadPhotosApiEditorTasksTaskIdPhotosPost({ path: { task_id: id }, body: { files } }),
    ) as Promise<PhotoRead[]>,
  setPhotos: (id: number, photoIds: number[]) =>
    apiData(
      updateGalleryApiEditorTasksTaskIdPhotosPut({
        path: { task_id: id },
        body: { photo_ids: photoIds },
      }),
    ) as Promise<PhotoRead[]>,
  uploadResource: (id: number, file: File) =>
    apiData(
      uploadApiEditorTasksTaskIdResourcesPost({
        path: { task_id: id },
        body: { file, title: file.name, type: "other" },
      }),
    ) as Promise<ResourceRead>,
  updateResource: (id: number, resourceId: number, title: string) =>
    apiData(
      updateApiEditorTasksTaskIdResourcesResourceIdPatch({
        path: { task_id: id, resource_id: resourceId },
        body: { title },
      }),
    ) as Promise<ResourceRead>,
  deleteResource: (id: number, resourceId: number) =>
    apiVoid(
      deleteApiEditorTasksTaskIdResourcesResourceIdDelete({
        path: { task_id: id, resource_id: resourceId },
      }),
    ),
}
