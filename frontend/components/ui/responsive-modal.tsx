"use client"

import { useSyncExternalStore, type ReactElement, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "./dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerTrigger,
  DrawerClose,
} from "./drawer"
import { Button } from "./button"

const desktopQuery = "(min-width: 768px)"
function subscribe(callback: () => void) {
  const query = window.matchMedia(desktopQuery)
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}
const getSnapshot = () => window.matchMedia(desktopQuery).matches
const getServerSnapshot = () => false

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  trigger?: ReactElement
  children: ReactNode
  footer?: ReactNode
}

/** Общее модальное окно: Drawer до 768px, Dialog на планшетах и десктопах. Данные формы и выбор следует хранить у вызывающего компонента. */
export default function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  footer,
}: ResponsiveModalProps) {
  const desktop = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (desktop)
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger render={trigger} />}
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer && <DialogFooter className="shrink-0">{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    )
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      {trigger && <DrawerTrigger render={trigger} />}
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
        <DrawerFooter>
          {footer}
          <DrawerClose render={<Button type="button" variant="outline" />}>Закрыть</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
