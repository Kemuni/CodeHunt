import Image from "next/image";

const links = [
  { href: "#top", label: "Главная" },
  { href: "#practice", label: "Каталог задач" },
  { href: "#portfolio", label: "Топ решений" },
  { href: "#how-to-start", label: "Как получить портфолио" },
];

export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-black px-10 py-6 text-white 2xl:px-[85px]">
      {/* Декорации */}
      <div className="pointer-events-none absolute left-[27.4%] top-16 z-0 w-full">
        <Image
          className="absolute left-0 top-0 hidden w-33 -translate-x-1/2 -translate-y-1/2
                    md:block 2xl:w-37"
          src="/figma/footer/footer-asterisk-small.svg"
          alt=""
          width={132}
          height={131}
          aria-hidden="true"
        />
        <Image
          className="absolute left-0 top-0 hidden w-54 -translate-x-1/2 -translate-y-1/2
                    lg:block 2xl:w-[245px]"
          src="/figma/footer/footer-asterisk-large.svg"
          alt=""
          width={217}
          height={216}
          aria-hidden="true"
        />
      </div>
      
      <Image
        className="pointer-events-none absolute right-8 top-12 z-0 hidden
                  w-50 lg:block 2xl:w-62"
        src="/figma/footer/footer-orange-ricky.svg"
        alt=""
        width={250}
        height={159}
        aria-hidden="true"
      />
      <Image
        className="pointer-events-none absolute -top-3 left-[52.6%] z-0 hidden
                  w-32 lg:block 2xl:w-42"
        src="/figma/footer/footer-lightbulb.svg"
        alt=""
        width={168}
        height={168}
        aria-hidden="true"
      />

      {/* Сетка контента */}
      <div
        className="relative z-10 flex justify-between max-w-full mx-20 gap-50
                  md:grid-cols-[minmax(0,1fr)_minmax(14rem,1fr)]
                  lg:grid-cols-[minmax(0,1fr)_minmax(14rem,1fr)_minmax(18.75rem,1fr)]"
      >
        {/* Логотип */}
        <div className="flex flex-col gap-1.5">
          <Image src="/figma/logo-white.svg" alt="Logo" width={90} height={64} />
          <p
            className="m-0 max-w-[12rem] text-muted-foreground
                      text-lg leading-[1.1]
                      2xl:text-xl"
          >
            Там, где идеи находят людей
          </p>
        </div>

        {/* Ссылки */}
        <nav aria-label="Ссылки в подвале">
          <h2
            className="m-0 mb-3 font-heading
                      text-lg font-normal leading-[1.3]
                      2xl:text-xl"
          >
            Ссылки
          </h2>
          <ul
            className="m-0 flex list-none flex-col gap-2 p-0
                      text-sm font-light leading-[1.17]
                      2xl:text-base"
          >
            {links.map((link) => (
              <li key={link.href}>
                <a
                  className="transition-opacity hover:opacity-70
                            focus-visible:outline focus-visible:outline-2
                            focus-visible:outline-offset-4
                            focus-visible:outline-primary-pink"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Контакты */}
        <address className="not-italic">
          <h2
            className="m-0 mb-3 font-heading
                      text-lg font-normal leading-[1.3]
                      2xl:text-xl"
          >
            Контакты
          </h2>
          <dl
            className="m-0 grid grid-cols-[6.5rem_1fr] gap-y-2
                      text-sm font-light leading-[1.17]
                      2xl:text-base"
          >
            <dt className="text-[var(--muted)]">Телефон:</dt>
            <dd className="m-0">
              <a className="hover:opacity-70" href="tel:+79999999999">
                +7 (999) 999-99-99
              </a>
            </dd>
            <dt className="text-[var(--muted)]">Email:</dt>
            <dd className="m-0">
              <a className="hover:opacity-70" href="mailto:support@kodmentor.ru">
                support@kodmentor.ru
              </a>
            </dd>
          </dl>
        </address>
      </div>
    </footer>
  );
}
