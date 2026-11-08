import React, { HTMLAttributes } from "react"
import { cn } from "cn"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

export type PageLayoutProps = HTMLAttributes<HTMLDivElement>

/** Задаёт внешние адаптивные отступы страницы; карточки разделов оформляются через SectionLayout. */
export const PageLayout: React.FC<PageLayoutProps> = ({ children, className, ...props }) => {
  return (
    <div className={cn("flex flex-col my-12 mx-4 sm:mx-21 2xl:mx-42", className)} {...props}>
      {children}
    </div>
  )
}

export type PageLayoutHeaderProps = HTMLAttributes<HTMLDivElement> & {
  /** Адрес страницы, на которую ведёт кнопка «Вернуться назад». */
  backHref?: string
}

/** Заголовок с декором и необязательной ссылкой возврата справа. */
export const PageLayoutHeader: React.FC<PageLayoutHeaderProps> = ({
  className,
  children,
  backHref,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-4",
        "text-3xl sm:text-5xl font-heading font-medium tracking-wide",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-6">
        <h2 className="min-w-0 wrap-anywhere">{children}</h2>
        <div aria-hidden="true" className="relative hidden size-20 shrink-0 xl:block">
          <Image src="/figma/Asterisk 2.svg" alt="" fill sizes="80px" />
        </div>
      </div>
      {backHref && (
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "link" }),
            "ml-auto shrink-0 font-sans tracking-normal",
          )}
        >
          <ArrowLeftIcon aria-hidden="true" />
          Вернуться назад
        </Link>
      )}
    </div>
  )
}

export type PageLayoutContentProps = HTMLAttributes<HTMLDivElement>

/** Размещает секции страницы вертикально с общими отступами. */
export const PageLayoutContent: React.FC<PageLayoutContentProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn("w-full min-h-screen mt-14 flex flex-col gap-6", className)} {...props}>
      {children}
    </div>
  )
}
