"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { signIn, signOut, useSession } from "next-auth/react"

const navigationLinks = [
  { href: "/tasks", label: "Каталог задач" },
  { href: "#portfolio", label: "Топ решений" },
  { href: "#why", label: "Направления" },
]

export function SiteHeader() {
  const { data: session, status } = useSession()
  const signedIn = session && !session.error

  return (
    <header className="relative z-49 flex min-h-23.5 w-full flex-wrap items-center gap-3 px-4 py-3 sm:px-6 xl:px-20">
      <Link href={"/"} className="block shrink-0">
        <Image src="/figma/our-logo.svg" alt="Track dev" width={90} height={64} priority />
      </Link>

      <nav
        className="order-last flex w-full justify-center gap-4 text-sm font-medium tracking-wide text-primary lg:absolute lg:left-1/2 lg:top-1/2 lg:order-none lg:w-auto lg:-translate-x-1/2 lg:-translate-y-1/2 lg:gap-6 lg:text-lg"
        aria-label="Основная навигация"
      >
        {navigationLinks.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>

      <div className="ml-auto flex gap-3 items-center">
        {status === "loading" ? (
          <span className="text-sm text-gray-400">Загрузка...</span>
        ) : signedIn ? (
          <>
            {session.user.isAdmin && (
              <Button variant="outline" nativeButton={false} size="sm" render={<Link href="/admin/tasks" />}>
                Админка
              </Button>
            )}
            <span className="hidden max-w-32 truncate text-sm font-medium text-gray-700 xl:inline">
              {session.user?.name || session.user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
              Выйти
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signIn("github", { callbackUrl: "/" })}
            >
              Войти
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => signIn("github", { callbackUrl: "/" })}
            >
              Регистрация
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
