import type { DraftRead, PhotoRead, ResourceDownloadRead } from "./task-contract"
import { apiRequest } from "./request"

/** Постоянные адреса фото проходят через тот же origin; доступ проверяется по сессии. */
export function taskPhotoUrl(photo: PhotoRead): string {
  return taskMediaUrl(photo.url)
}

/** Скачивание файлов и показ фотографий используют общий прокси с проверкой доступа. */
export function taskMediaUrl(url: string): string {
  return /^\/api\/media\/(photos|resources)\/\d+$/.test(url)
    ? `/api/backend/${url.slice("/api/".length)}`
    : url
}

function photoForm(files: File[], revision?: number) {
  const data = new FormData()
  files.forEach((file) => data.append("files", file))
  if (revision !== undefined) data.append("revision", String(revision))
  return data
}

function resourceForm(file: File, revision?: number) {
  const data = new FormData()
  data.append("file", file)
  data.append("title", file.name)
  data.append("type", "other")
  if (revision !== undefined) data.append("revision", String(revision))
  return data
}

/** Каждая операция требует revision и возвращает весь черновик с новой ревизией и ошибками валидации. */
export const draftMediaApi = {
  uploadPhotos: (id: number, revision: number, files: File[]) =>
    apiRequest<DraftRead>(`editor/task-drafts/${id}/photos`, {
      method: "POST",
      body: photoForm(files, revision),
    }),
  setPhotos: (id: number, revision: number, photoIds: number[]) =>
    apiRequest<DraftRead>(`editor/task-drafts/${id}/photos`, {
      method: "PUT",
      body: { photo_ids: photoIds, revision },
    }),
  uploadResource: (id: number, revision: number, file: File) =>
    apiRequest<DraftRead>(`editor/task-drafts/${id}/resources`, {
      method: "POST",
      body: resourceForm(file, revision),
    }),
  deleteResource: (id: number, revision: number, resourceId: number) =>
    apiRequest<DraftRead>(`editor/task-drafts/${id}/resources/${resourceId}?revision=${revision}`, {
      method: "DELETE",
    }),
}

/** Вложения готовой задачи меняются сразу. Тип ответа зависит от операции, revision здесь нет. */
export const taskMediaApi = {
  uploadPhotos: (id: number, files: File[]) =>
    apiRequest<PhotoRead[]>(`editor/tasks/${id}/photos`, {
      method: "POST",
      body: photoForm(files),
    }),
  setPhotos: (id: number, photoIds: number[]) =>
    apiRequest<PhotoRead[]>(`editor/tasks/${id}/photos`, {
      method: "PUT",
      body: { photo_ids: photoIds },
    }),
  uploadResource: (id: number, file: File) =>
    apiRequest<ResourceDownloadRead>(`editor/tasks/${id}/resources`, {
      method: "POST",
      body: resourceForm(file),
    }),
  deleteResource: (id: number, resourceId: number) =>
    apiRequest<null>(`editor/tasks/${id}/resources/${resourceId}`, { method: "DELETE" }),
}
