"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signIn, signOut, useSession } from "next-auth/react";

const navigationLinks = [
  { href: "#practice", label: "Каталог задач" },
  { href: "#portfolio", label: "Топ решений" },
  { href: "#why", label: "Направления" },
];

export function SiteHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="relative z-999 flex h-23.5 w-full items-center px-21.25 xl:px-42">
      <Link href={"/"} className="block shrink-0">
        <Image
          src="/figma/our-logo.svg"
          alt="Track dev"
          width={90}
          height={64}
          priority
        />
      </Link>

      <nav
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-8 text-xl font-medium tracking-wide text-primary"
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
        ) : session ? (
          <>
            <span className="text-sm font-medium text-gray-700">
              {session.user?.name || session.user?.email}
            </span>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Выйти
            </Button>
          </>
        ) : (

          <>
            <Button
              variant="outline"
              size="lg"
              onClick={() => signIn("github", { callbackUrl: "/" })}
            >
              Войти
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={() => signIn("github", { callbackUrl: "/" })}
            >
              Регистрация
            </Button>
          </>
        )}
      </div>
    </header>
  );
}