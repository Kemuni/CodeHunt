import Image from "next/image"

const links = [
  { href: "#top", label: "Главная" },
  { href: "/tasks", label: "Каталог задач" },
  { href: "#portfolio", label: "Топ решений" },
  { href: "#how-to-start", label: "Как получить портфолио" },
]

export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-black px-4 py-8 text-white sm:px-6 sm:py-10 lg:px-10 2xl:px-21.25">
      {/* Декорации */}
      <div className="pointer-events-none absolute left-[27.4%] top-16 z-0 w-full">
        <Image
          className="absolute left-0 top-0 h-auto hidden w-33 -translate-x-1/2 -translate-y-1/2
                    md:block 2xl:w-37"
          src="/figma/footer/footer-asterisk-small.svg"
          alt=""
          width={0}
          height={0}
          aria-hidden="true"
        />
        <Image
          className="absolute left-0 top-0 hidden h-auto w-54 -translate-x-1/2 -translate-y-1/2
                    lg:block 2xl:w-61.25"
          src="/figma/footer/footer-asterisk-large.svg"
          alt=""
          width={0}
          height={0}
          aria-hidden="true"
        />
      </div>

      <Image
        className="pointer-events-none absolute h-auto right-8 top-12 z-0 hidden
                  w-50 lg:block 2xl:w-62"
        src="/figma/footer/footer-orange-ricky.svg"
        alt=""
        width={0}
        height={0}
        aria-hidden="true"
      />
      <Image
        className="pointer-events-none absolute h-auto -top-3 left-[52.6%] z-0 hidden
                  w-32 lg:block 2xl:w-42"
        src="/figma/footer/footer-lightbulb.svg"
        alt=""
        width={0}
        height={0}
        aria-hidden="true"
      />

      {/* Сетка контента */}
      <div
        className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-8
                  sm:grid-cols-2 sm:gap-10
                  lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12"
      >
        {/* Логотип */}
        <div className="flex min-w-0 flex-col gap-2 sm:col-span-2 lg:col-span-1">
          <Image src="/figma/logo-white.svg" alt="Track Dev" width={90} height={64} />
          <p
            className="m-0 max-w-48 text-muted-foreground
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
                  className="inline-block py-1 transition-opacity hover:opacity-70
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
        <address className="min-w-0 not-italic">
          <h2
            className="m-0 mb-3 font-heading
                      text-lg font-normal leading-[1.3]
                      2xl:text-xl"
          >
            Контакты
          </h2>
          <dl
            className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3
                      text-sm font-light leading-[1.17]
                      2xl:text-base"
          >
            <dt className="text-muted">Телефон:</dt>
            <dd className="m-0 min-w-0 wrap-break-word">
              <a className="inline-block py-1 hover:opacity-70" href="tel:+79999999999">
                +7 (999) 999-99-99
              </a>
            </dd>
            <dt className="text-muted">Email:</dt>
            <dd className="m-0 min-w-0 wrap-break-word">
              <a className="inline-block py-1 hover:opacity-70" href="mailto:support@kodmentor.ru">
                support@kodmentor.ru
              </a>
            </dd>
          </dl>
        </address>
      </div>
    </footer>
  )
}
