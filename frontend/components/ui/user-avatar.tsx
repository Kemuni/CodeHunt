"use client"

import { Avatar } from "@base-ui/react/avatar"
import { cn } from "@/lib/utils"

export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string
  src?: string | null
  className?: string
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase()

  return (
    <Avatar.Root
      data-slot="user-avatar"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-foreground",
        className,
      )}
    >
      <Avatar.Image
        src={src ?? undefined}
        alt={`Аватар ${name}`}
        className="size-full object-cover"
        referrerPolicy="no-referrer"
      />
      <Avatar.Fallback aria-label={`Аватар ${name}`}>{initials || "?"}</Avatar.Fallback>
    </Avatar.Root>
  )
}
