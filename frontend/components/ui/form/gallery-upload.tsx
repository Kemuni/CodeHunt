"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { formatBytes } from "@/lib/hooks/use-file-upload"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { CircleAlertIcon, ImageIcon, StarIcon, UploadIcon, XIcon, ZoomInIcon } from "lucide-react"
import { cn } from "cn"

export interface GalleryImage {
  id: number
  name: string
  size: number
  url: string
  isCover: boolean
}

interface GalleryUploadProps {
  files: GalleryImage[]
  busy?: boolean
  minFiles?: number
  maxFiles?: number
  maxSize?: number
  className?: string
  onUpload: (files: File[]) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onClear: () => Promise<void>
  onCover: (id: number) => Promise<void>
}

const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

/** Галерея с выбором, перетаскиванием и предпросмотром. Владелец сохраняет изменения и передаёт подтверждённые изображения через files. */
export function GalleryUpload({
  files,
  busy = false,
  minFiles = 0,
  maxFiles = 4,
  maxSize = 5 * 1024 * 1024,
  className,
  onUpload,
  onRemove,
  onClear,
  onCover,
}: GalleryUploadProps) {
  const input = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)
  const [pending, setPending] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const disabled = busy || pending

  const runOperation = async (operation: () => Promise<void>) => {
    if (disabled || inFlight.current) return
    inFlight.current = true
    setPending(true)
    setErrors([])
    try {
      await operation()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Не удалось сохранить фотографии"])
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }
  const upload = (selected: File[]) => {
    if (disabled || !selected.length) return
    const problems: string[] = []
    if (selected.length + files.length > maxFiles)
      problems.push(`Можно добавить не более ${maxFiles} фотографий`)
    if (selected.some((file) => file.size > maxSize))
      problems.push(`Размер фотографии не должен превышать ${formatBytes(maxSize)}`)
    if (
      selected.some(
        (file) =>
          !imageTypes.includes(file.type.toLowerCase()) && !/\.(jpe?g|png|webp)$/i.test(file.name),
      )
    )
      problems.push("Выберите фотографии JPG, JPEG, PNG или WebP")
    setErrors(problems)
    if (!problems.length) void runOperation(() => onUpload(selected))
  }

  return (
    <div className={cn("w-full max-w-4xl", className)} aria-busy={disabled}>
      <div
        className={cn(
          "relative rounded-lg border border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          upload(Array.from(event.dataTransfer.files))
        }}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept={[...imageTypes, ".jpg", ".jpeg", ".png", ".webp"].join(",")}
          disabled={disabled}
          className="sr-only"
          aria-label="Загрузить фотографии"
          onChange={(event) => {
            upload(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full",
              isDragging ? "bg-primary/10" : "bg-muted",
            )}
          >
            <ImageIcon className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Загрузите изображения</h3>
            <p className="text-sm text-muted-foreground">
              Перетащите изображения сюда или нажмите на кнопку
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WebP не более {formatBytes(maxSize)} каждый (максимум {maxFiles} файлов)
            </p>
          </div>
          <Button
            type="button"
            disabled={disabled || files.length >= maxFiles}
            onClick={() => input.current?.click()}
          >
            {disabled ? <Spinner /> : <UploadIcon />}{" "}
            {disabled ? "Сохраняем…" : "Выбрать изображения"}
          </Button>
        </div>
      </div>
      {!!files.length && (
        <>
          <div className="mt-6 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium">
                Галерея ({files.length}/{maxFiles})
              </h4>
              <p className="text-xs text-muted-foreground">
                Всего: {formatBytes(files.reduce((sum, file) => sum + file.size, 0))}
              </p>
            </div>
            <Button
              type="button"
              disabled={disabled || minFiles > 0}
              onClick={() => void runOperation(onClear)}
              variant="outline"
              size="sm"
            >
              Очистить все
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {files.map((file) => (
              <div key={file.id} className="group/item min-w-0">
                <div className="relative aspect-square overflow-hidden rounded-lg border">
                  <Image
                    src={file.url}
                    alt={file.name}
                    fill
                    unoptimized
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/item:opacity-100">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      aria-label={`Посмотреть ${file.name}`}
                      onClick={() => {
                        setSelectedImage(file)
                        setIsPreviewLoading(true)
                      }}
                    >
                      <ZoomInIcon />
                    </Button>
                    <Button
                      type="button"
                      disabled={disabled || files.length <= minFiles}
                      variant="secondary"
                      size="icon-sm"
                      aria-label={`Удалить ${file.name}`}
                      onClick={() => void runOperation(() => onRemove(file.id))}
                    >
                      <XIcon />
                    </Button>
                  </div>
                </div>
                <p className="mt-1 truncate text-xs" title={file.name}>
                  {file.name}
                </p>
                <Button
                  type="button"
                  disabled={disabled || file.isCover}
                  variant="ghost"
                  size="sm"
                  className="w-full px-1"
                  onClick={() => void runOperation(() => onCover(file.id))}
                >
                  <StarIcon fill={file.isCover ? "#000" : "transparent"} />
                  {file.isCover ? "Титульное" : "На обложку"}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
      {!!errors.length && (
        <Alert variant="destructive" className="mt-5">
          <CircleAlertIcon />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
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
                {isPreviewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner className="size-8" />
                  </div>
                )}
                <Image
                  src={selectedImage.url}
                  alt={selectedImage.name}
                  fill
                  unoptimized
                  sizes="(min-width: 640px) 36rem, 100vw"
                  onLoad={() => setIsPreviewLoading(false)}
                  onError={() => setIsPreviewLoading(false)}
                  className="rounded-lg object-contain"
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
