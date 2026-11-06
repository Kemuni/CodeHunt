"use client"

import { useId, useState } from "react"
import { cn } from "cn"

interface ExpandableTextProps {
  text: string
  maxLength?: number
  maxLines?: number
  as?: "p" | "span"
  className?: string
}

export function getTextPreview(text: string, maxLength = 300, maxLines = 4) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const characters = Array.from(lines.slice(0, maxLines).join("\n"))
  const truncated = lines.length > maxLines || characters.length > maxLength

  return {
    truncated,
    preview: truncated ? `${characters.slice(0, maxLength).join("").trimEnd()}…` : text,
  }
}

/** Ограничивает текст карточки по длине и числу строк; раскрывает его локально, не меняя сохранённые данные. */
export default function ExpandableText({
  text,
  maxLength = 300,
  maxLines = 4,
  as: Tag = "p",
  className,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const { truncated, preview } = getTextPreview(text, maxLength, maxLines)

  return (
    <Tag className={cn("whitespace-pre-wrap wrap-anywhere", className)}>
      <span id={contentId}>{expanded ? text : preview}</span>
      {truncated && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
          className="ml-1 inline cursor-pointer rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {expanded ? "Скрыть" : "Показать"}
        </button>
      )}
    </Tag>
  )
}
