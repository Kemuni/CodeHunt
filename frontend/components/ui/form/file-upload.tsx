"use client"

import { useEffect, useState } from "react"
import {
  formatBytes,
  useFileUpload,
  type FileMetadata,
  type FileWithPreview,
} from "@/lib/hooks/use-file-upload"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ImageIcon,
  VideoIcon,
  HeadphonesIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  FileArchiveIcon,
  UploadIcon,
  CloudUploadIcon,
  Trash2Icon,
  DownloadIcon,
  RefreshCwIcon,
  CircleAlertIcon,
} from "lucide-react"

interface FileUploadItem extends FileWithPreview {
  progress: number
  status: "ready" | "uploading" | "completed" | "error"
  error?: string
}

interface FileUploadProps {
  maxFiles?: number
  maxSize?: number
  accept?: string
  multiple?: boolean
  className?: string
  onFilesChange?: (files: FileWithPreview[]) => void
  /** Демонстрация прогресса и ошибок без отправки на сервер. По умолчанию выключена. */
  simulateUpload?: boolean
}

/** Выбор вложений с таблицей файлов и ограничениями. Передаёт файлы через onFilesChange; не использует Form и не отправляет их на сервер. */
export function FileUpload({
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50 МБ
  accept = "*",
  multiple = true,
  className,
  onFilesChange,
  simulateUpload = false,
}: FileUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<FileUploadItem[]>([])

  const [
    { isDragging, errors },
    {
      removeFile,
      clearFiles,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      getInputProps,
    },
  ] = useFileUpload({
    maxFiles,
    maxSize,
    accept,
    multiple,
    onFilesChange: (newFiles) => {
      // При изменении списка сохраняем прогресс уже выбранных файлов.
      setUploadFiles((previous) =>
        newFiles.map((file) => {
          const existingFile = previous.find((existing) => existing.id === file.id)
          return existingFile
            ? { ...existingFile, ...file }
            : { ...file, progress: 0, status: simulateUpload ? "uploading" : "ready" }
        }),
      )
      onFilesChange?.(newFiles)
    },
  })

  // Демонстрационный прогресс: сетевых запросов здесь нет.
  useEffect(() => {
    if (!simulateUpload) return

    const interval = setInterval(() => {
      setUploadFiles((prev) =>
        prev.map((file) => {
          if (file.status !== "uploading") return file

          const increment = Math.random() * 15 + 5 // Прибавляем от 5 до 20%.
          const newProgress = Math.min(file.progress + increment, 100)

          if (newProgress >= 100) {
            // В демонстрационном режиме иногда показываем ошибку.
            const shouldFail = Math.random() < 0.1 // Вероятность ошибки — 10%.
            return {
              ...file,
              progress: 100,
              status: shouldFail ? ("error" as const) : ("completed" as const),
              error: shouldFail ? "Не удалось загрузить файл. Попробуйте ещё раз." : undefined,
            }
          }

          return { ...file, progress: newProgress }
        }),
      )
    }, 500)

    return () => clearInterval(interval)
  }, [simulateUpload])

  const removeUploadFile = (fileId: string) => {
    setUploadFiles((prev) => prev.filter((file) => file.id !== fileId))
    removeFile(fileId)
  }

  const retryUpload = (fileId: string) => {
    setUploadFiles((prev) =>
      prev.map((file) =>
        file.id === fileId
          ? {
              ...file,
              progress: 0,
              status: "uploading" as const,
              error: undefined,
            }
          : file,
      ),
    )
  }

  const getFileIcon = (file: File | FileMetadata) => {
    const type = file.type
    if (type.startsWith("image/")) return <ImageIcon className="size-4" />
    if (type.startsWith("video/")) return <VideoIcon className="size-4" />
    if (type.startsWith("audio/")) return <HeadphonesIcon className="size-4" />
    if (type.includes("pdf")) return <FileTextIcon className="size-4" />
    if (type.includes("word") || type.includes("doc")) return <FileTextIcon className="size-4" />
    if (type.includes("excel") || type.includes("sheet"))
      return <FileSpreadsheetIcon className="size-4" />
    if (type.includes("zip") || type.includes("rar")) return <FileArchiveIcon className="size-4" />
    return <FileTextIcon className="size-4" />
  }

  const getFileTypeLabel = (file: File | FileMetadata) => {
    const type = file.type
    if (type.startsWith("image/")) return "Изображение"
    if (type.startsWith("video/")) return "Видео"
    if (type.startsWith("audio/")) return "Аудио"
    if (type.includes("pdf")) return "PDF"
    if (type.includes("word") || type.includes("doc")) return "Word"
    if (type.includes("excel") || type.includes("sheet")) return "Excel"
    if (type.includes("zip") || type.includes("rar")) return "Архив"
    if (type.includes("json")) return "JSON"
    if (type.includes("text")) return "Текст"
    return "Файл"
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Область выбора файлов */}
      <div
        className={cn(
          "relative rounded-lg border border-dashed p-6 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input {...getInputProps()} aria-label="Выбрать вложения" className="sr-only" />

        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "bg-muted flex h-12 w-12 items-center justify-center rounded-full transition-colors",
              isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25",
            )}
          >
            <UploadIcon className="text-muted-foreground h-5 w-5" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Перетащите файлы сюда или{" "}
              <button
                type="button"
                onClick={openFileDialog}
                className="text-primary cursor-pointer underline-offset-4 hover:underline"
              >
                выберите файлы
              </button>
            </p>
            <p className="text-muted-foreground text-xs">
              Максимальный размер файла: {formatBytes(maxSize)} • Максимум файлов: {maxFiles}
            </p>
          </div>
        </div>
      </div>

      {/* Список выбранных файлов */}
      {uploadFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Файлы ({uploadFiles.length})</h3>
            <div className="flex gap-2">
              <Button type="button" onClick={openFileDialog} variant="outline" size="sm">
                <CloudUploadIcon className="h-4 w-4" />
                Добавить файлы
              </Button>
              <Button type="button" onClick={clearFiles} variant="outline" size="sm">
                <Trash2Icon className="h-4 w-4" />
                Удалить все
              </Button>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="h-9 ps-4">Название</TableHead>
                  <TableHead className="h-9">Тип</TableHead>
                  <TableHead className="h-9">Размер</TableHead>
                  <TableHead className="h-9 w-25 ps-4">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadFiles.map((fileItem) => (
                  <TableRow key={fileItem.id}>
                    <TableCell className="py-2 ps-1.5">
                      <div className="flex items-center gap-1">
                        <div
                          className={cn(
                            "text-muted-foreground/80 relative flex size-8 shrink-0 items-center justify-center",
                          )}
                        >
                          {fileItem.status === "uploading" ? (
                            <div className="relative">
                              {/* Фон кругового индикатора */}
                              <svg className="size-8 -rotate-90" viewBox="0 0 32 32">
                                <circle
                                  cx="16"
                                  cy="16"
                                  r="14"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className="text-muted-foreground/20"
                                />
                                {/* Прогресс загрузки */}
                                <circle
                                  cx="16"
                                  cy="16"
                                  r="14"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeDasharray={`${2 * Math.PI * 14}`}
                                  strokeDashoffset={`${2 * Math.PI * 14 * (1 - fileItem.progress / 100)}`}
                                  className="text-primary transition-all duration-300"
                                  strokeLinecap="round"
                                />
                              </svg>
                              {/* Значок файла в центре */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                {getFileIcon(fileItem.file)}
                              </div>
                            </div>
                          ) : (
                            <div className="flex size-8 items-center justify-center">
                              {getFileIcon(fileItem.file)}
                            </div>
                          )}
                        </div>
                        <p className="flex items-center gap-1 truncate text-sm font-medium">
                          {fileItem.file.name}
                          {fileItem.status === "error" && (
                            <Badge variant="destructive-light" size="sm">
                              Ошибка
                            </Badge>
                          )}
                        </p>
                      </div>
                      {fileItem.error && (
                        <p role="alert" className="px-2 text-xs text-destructive">
                          {fileItem.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="secondary" className="text-xs">
                        {getFileTypeLabel(fileItem.file)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground py-2 text-sm">
                      {formatBytes(fileItem.file.size)}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        {fileItem.preview && (
                          <Button
                            render={<a href={fileItem.preview} download={fileItem.file.name} />}
                            nativeButton={false}
                            aria-label={`Скачать ${fileItem.file.name}`}
                            size="icon"
                            variant="ghost"
                            className="size-8"
                          >
                            <DownloadIcon className="size-3.5" />
                          </Button>
                        )}
                        {fileItem.status === "error" ? (
                          <Button
                            type="button"
                            aria-label={`Повторить загрузку ${fileItem.file.name}`}
                            onClick={() => retryUpload(fileItem.id)}
                            variant="ghost"
                            size="icon"
                            className="text-destructive/80 hover:text-destructive size-8"
                          >
                            <RefreshCwIcon className="size-3.5" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            aria-label={`Удалить ${fileItem.file.name}`}
                            onClick={() => removeUploadFile(fileItem.id)}
                            variant="ghost"
                            size="icon"
                            className="size-8"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Ошибки выбора файлов */}
      {errors.length > 0 && (
        <Alert variant="destructive" className="mt-5">
          <CircleAlertIcon />
          <AlertTitle>Ошибка загрузки файлов</AlertTitle>
          <AlertDescription>
            {errors.map((error, index) => (
              <p key={index} className="last:mb-0">
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
