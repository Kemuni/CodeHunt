import Image from "next/image";
import Link from "next/link";
import {Button} from "@/components/ui/button";

const navigationLinks = [
  { href: "#practice", label: "Каталог задач" },
  { href: "#portfolio", label: "Топ решений" },
  { href: "#why", label: "Направления" },
];

export function SiteHeader() {
  return (
    <header className="relative flex h-23.5 w-screen items-center px-21.25">
      <Link href={""} className="block shrink-0">
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

      <div className="ml-auto flex gap-3">
        <Link href={""}>
          <Button variant="outline" size="lg">
            Войти
          </Button>
        </Link>
        <Link href={""}>
          <Button variant="default" size="lg">
            Регистрация
          </Button>
        </Link>
      </div>
    </header>
  );
}
