import Image from "next/image";

const navigationLinks = [
  { href: "#practice", label: "Каталог задач" },
  { href: "#portfolio", label: "Топ решений" },
  { href: "#why", label: "Направления" },
];

export function SiteHeader() {
  return (
    <header className="relative flex h-[94px] min-w-[1440px] items-center px-[85px]">
      <a className="block shrink-0" href="#top" aria-label="Код Ментор">
        <Image
          src="/figma/code-mentor-logo.svg"
          alt="Код Ментор"
          width={121}
          height={64}
          priority
        />
      </a>

      <nav
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-8 text-2xl font-bold leading-7 text-[var(--ink)]"
        aria-label="Основная навигация"
      >
        {navigationLinks.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>

      <div className="ml-auto flex gap-3">
        <a
          className="inline-flex h-[38px] w-[153px] items-center justify-center rounded-full border border-[var(--ink)] text-xl font-semibold leading-[22px] text-[var(--ink)]"
          href="#contact"
        >
          Войти
        </a>
        <a
          className="inline-flex h-[38px] w-[153px] items-center justify-center rounded-full bg-[var(--ink)] text-xl font-medium leading-[22px] text-white"
          href="#contact"
        >
          Регистрация
        </a>
      </div>
    </header>
  );
}
