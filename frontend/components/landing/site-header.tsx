"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { MenuIcon, XIcon } from "lucide-react"
import { signIn, signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/ui/user-avatar"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import GithubIcon from "@/components/icons/github";

const navigationLinks = [
  { href: "/tasks", label: "Каталог задач" },
  { href: "/#portfolio", label: "Топ решений" },
  { href: "/#why", label: "Направления" },
]

function AccountActions({ className, onAction }: { className: string; onAction?: () => void }) {
  const { data: session, status } = useSession()
  if (status === "loading") return <span className={className}>Загрузка...</span>

  return (
    <div className={className}>
      {session && !session.error ? (
        <>
          {session.user.isAdmin && (
            <Button
              variant="outline"
              nativeButton={false}
              role="link"
              render={<Link href="/admin/tasks" />}
              onClick={onAction}
            >
              Админка
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              onAction?.()
              void signOut({ callbackUrl: "/" })
            }}
          >
            Выйти
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="default"
            size="lg"
            className="bg-black"
            onClick={() => {
              onAction?.()
              void signIn("github", { callbackUrl: "/" })
            }}
          >
            <GithubIcon className="text-white" /> {" "} Войти с помощью GitHub
          </Button>
        </>
      )}
    </div>
  )
}

export function SiteHeader() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const signedIn = session && !session.error
  const displayName = session?.user?.name || session?.user?.email || "Пользователь"
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    // При переходе к десктопной шапке снимаем блокировку прокрутки и фокуса Drawer.
    const desktop = window.matchMedia("(min-width: 1024px)")
    const onResize = () => {
      if (desktop.matches) setMenuOpen(false)
    }
    desktop.addEventListener("change", onResize)
    return () => desktop.removeEventListener("change", onResize)
  }, [])

  return (
    <header className="relative z-49 grid grid-cols-[0.5fr_1fr_0.5fr] min-h-20 w-full items-center gap-2 px-4 py-2 sm:gap-4 sm:px-6 lg:min-h-23.5 lg:py-3 xl:px-20">
      <Link href="/" className="block shrink-0" onClick={closeMenu}>
        <Image src="/figma/our-logo.svg" alt="Track dev" width={90} height={64} priority />
      </Link>

      <nav
        className="hidden min-w-0 flex-1 items-center justify-center gap-4 text-base font-medium tracking-wide text-primary lg:flex xl:gap-6 xl:text-lg"
        aria-label="Основная навигация"
      >
        {navigationLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        {signedIn && (
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar name={displayName} src={session.user.image} />
            <span
              className="max-w-20 truncate text-sm font-medium text-gray-700 sm:max-w-32"
              title={displayName}
            >
              {displayName}
            </span>
          </div>
        )}
        <AccountActions className="hidden items-center gap-3 lg:flex" />

        <Drawer open={menuOpen} onOpenChange={setMenuOpen} swipeDirection="right">
          <DrawerTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="lg:hidden"
                aria-label="Открыть меню"
              />
            }
          >
            <MenuIcon aria-hidden="true" />
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="flex-row items-center justify-between gap-3 pb-4">
              <DrawerTitle>Меню</DrawerTitle>
              <DrawerClose
                render={<Button variant="ghost" size="icon-lg" aria-label="Закрыть меню" />}
              >
                <XIcon aria-hidden="true" />
              </DrawerClose>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <nav aria-label="Мобильная навигация" className="flex flex-col gap-2">
                {navigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className="rounded-xl px-3 py-3 text-base font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <AccountActions
                className="mt-auto flex flex-col gap-3 border-t pt-4 [&_button]:min-h-11 [&_a]:min-h-11"
                onAction={closeMenu}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </header>
  )
}
