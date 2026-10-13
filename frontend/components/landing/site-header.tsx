import Image from "next/image";
import { Menu } from "lucide-react";

const navigationLinks = [
  { href: "#practice", label: "Каталог задач" },
  { href: "#portfolio", label: "Топ решений" },
  { href: "#why", label: "Направления" },
];

export function SiteHeader() {
  return (
    <header
      className="relative flex h-[72px] w-full items-center px-10
                 2xl:h-[94px] 2xl:px-[85px]"
    >
      {/* Логотип */}
      <a className="block shrink-0" href="#top" aria-label="Код Ментор">
        <Image
          src="/figma/code-mentor-logo.svg"
          alt="Код Ментор"
          width={121}
          height={64}
          priority
          className="h-12 w-auto 2xl:h-16"
        />
      </a>

      {/* Навигация — по центру, от md и выше */}
      <nav
        className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2
                   gap-6 text-lg font-bold leading-6 text-[var(--ink)]
                   2xl:gap-8 2xl:text-2xl 2xl:leading-7 md:flex"
        aria-label="Основная навигация"
      >
        {navigationLinks.map((link) => (
          <a key={link.href} href={link.href} className="whitespace-nowrap">
            {link.label}
          </a>
        ))}
      </nav>

      {/* Кнопки справа */}
      <div className="ml-auto flex items-center gap-2 2xl:gap-3">
        <a
          className="hidden h-9 w-32 items-center justify-center rounded-full
                     border border-[var(--ink)] text-base font-semibold leading-5
                     text-[var(--ink)]
                     2xl:h-[38px] 2xl:w-[153px] 2xl:text-xl 2xl:leading-[22px]
                     sm:inline-flex"
          href="#contact"
        >
          Войти
        </a>
        <a
          className="inline-flex h-9 w-32 items-center justify-center rounded-full
                     bg-[var(--ink)] text-base font-medium leading-5 text-white
                     2xl:h-[38px] 2xl:w-[153px] 2xl:text-xl 2xl:leading-[22px]"
          href="#contact"
        >
          Регистрация
        </a>

        {/* Бургер — только на мобилках */}
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-full
                     border border-[var(--ink)] text-[var(--ink)]
                     2xl:size-[38px] md:hidden"
          aria-label="Открыть меню"
        >
          <Menu className="size-[70%]" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}