import { Lightbulb, FileText, Check, Ellipsis, Puzzle } from "lucide-react";

export function HowToStart() {
  return (
    <section
      className="flex w-full flex-col gap-6 overflow-hidden pb-16 pt-6
                 2xl:gap-8 2xl:pb-20 2xl:pt-8"
      aria-labelledby="how-to-start-title"
    >
      <div className="mx-auto flex w-[min(84%,1209px)] flex-col items-center">
        <p className="m-0 inline-flex items-center gap-2 text-base leading-[18px]
                      text-[var(--muted)]
                      2xl:text-lg 2xl:leading-[19px]">
          <Lightbulb
            className="size-4 text-[var(--lavender)]"
            strokeWidth={2}
            aria-hidden="true"
          />
          Основа
        </p>
        <h2
          id="how-to-start-title"
          className="m-0 mt-0.5 font-[family-name:var(--heading)]
                     text-[40px] font-medium leading-[1.05] tracking-[1px]
                     text-[var(--ink)]
                     2xl:text-[60px] 2xl:tracking-[1.2px]"
        >
          Как начать?
        </h2>
      </div>

      <div className="grid grid-cols-10 gap-2 px-10 2xl:px-40">
        {/* ─────────── Левый блок ─────────── */}
        <div
          className="relative col-span-7 flex h-auto flex-col gap-6 rounded-2xl
                     border border-[var(--grid)] overflow-hidden
                     w-[round(down,100%,var(--cell))]
                     bg-[linear-gradient(to_right,var(--grid)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid)_1px,transparent_1px)]
                     bg-[size:var(--cell)_var(--cell)]
                     px-[var(--cell)] py-[var(--cell)]
                     2xl:gap-10"
        >
          {/* градиент поверх сетки */}
          <div className="pointer-events-none absolute inset-0
                          bg-[linear-gradient(to_left,#FFFFFF0D,#B6A2D44D)]"></div>

          {/* контент поверх градиента */}
          <div className="relative z-10 flex flex-col gap-6 2xl:gap-10">
            {/* Карточка 1 — Заполни профиль */}
            <div className="flex h-32 flex-row items-center gap-4 rounded-2xl
                            border border-[var(--grid)] bg-white px-4 py-4
                            w-[round(up,100%,var(--cell))]
                            2xl:h-40 2xl:gap-6">
              <div className="inline-flex h-full aspect-square rounded-lg
                              bg-[var(--ink)]/10">
                <FileText
                  className="m-auto size-16 text-[var(--ink)] 2xl:size-22"
                  strokeWidth={1}
                />
              </div>
              <div className="w-full font-medium text-black">
                <p className="font-[family-name:var(--heading)] text-2xl
                              2xl:text-3xl">
                  Заполни профиль
                </p>
                <p className="font-[family-name:var(--body)] text-base
                              2xl:text-xl">
                  Так работодатели узнают о тебе больше
                </p>
              </div>
              <div className="inline-flex h-1/2 aspect-square items-center
                              justify-center rounded-full
                              bg-[var(--green-check)]">
                <Check
                  className="m-auto size-8 text-white 2xl:size-12"
                  strokeWidth={2}
                />
              </div>
            </div>

            {/* Карточка 2 — Опиши портфолио */}
            <div className="flex h-32 flex-row items-center gap-4 rounded-2xl
                            border border-[var(--grid)] bg-white px-4 py-4
                            w-[round(up,100%,var(--cell))]
                            2xl:h-40 2xl:gap-6">
              <div className="inline-flex h-full aspect-square rounded-lg
                              bg-[var(--lavender)]/10">
                <Lightbulb
                  className="m-auto size-16 text-[var(--lavender)] 2xl:size-22"
                  strokeWidth={1}
                />
              </div>
              <div className="w-full font-medium text-black">
                <p className="font-[family-name:var(--heading)] text-2xl
                              2xl:text-3xl">
                  Опиши свое портфолио
                </p>
                <p className="font-[family-name:var(--body)] text-base
                              2xl:text-xl">
                  Так работодатели узнают о тебе больше
                </p>
              </div>
              <div className="inline-flex h-1/2 aspect-square items-center
                              justify-center rounded-full
                              bg-[var(--green-check)]">
                <Check
                  className="m-auto size-8 text-white 2xl:size-12"
                  strokeWidth={2}
                />
              </div>
            </div>

            {/* Карточка 3 — Сделай тестовое */}
            <div className="flex h-32 flex-row items-center gap-4 rounded-2xl
                            border border-[var(--grid)] bg-white px-4 py-4
                            w-[round(up,100%,var(--cell))]
                            2xl:h-40 2xl:gap-6">
              <div className="inline-flex h-full aspect-square rounded-lg
                              bg-[var(--light-green)]/10">
                <Puzzle
                  className="m-auto size-16 text-[var(--light-green)] 2xl:size-22"
                  strokeWidth={1}
                />
              </div>
              <div className="w-full font-medium text-black">
                <p className="font-[family-name:var(--heading)] text-2xl
                              2xl:text-3xl">
                  Сделай тестовое
                </p>
                <p className="font-[family-name:var(--body)] text-base
                              2xl:text-xl">
                  Так работодатели узнают о тебе больше
                </p>
              </div>
              <div className="inline-flex h-1/2 aspect-square items-center
                              justify-center rounded-full
                              bg-[var(--orange-dots)]">
                <Ellipsis
                  className="m-auto size-8 text-white 2xl:size-12"
                  strokeWidth={2}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─────────── Правый блок ─────────── */}
        <div
          className="relative col-span-3 flex items-center rounded-2xl
                     border border-[var(--grid)] overflow-hidden
                     w-[round(down,100%,var(--cell))]
                     bg-[radial-gradient(circle,var(--grid)_4px,transparent_1px)]
                     bg-[size:24px_24px]
                     2xl:bg-[size:30px_30px]"
        >
          <div className="pointer-events-none absolute inset-0
                          bg-[linear-gradient(to_left,#FFFFFF0D,#B6A2D44D)]"></div>
          <div className="relative z-10 flex flex-col gap-6 px-6 py-6
                          2xl:gap-10 2xl:px-20">
            {/* Карточка — Перейти к задачам */}
            <div className="flex h-auto flex-col gap-6 rounded-2xl bg-white
                            px-4 py-4 2xl:gap-8">
              <div className="w-fit rounded-lg bg-[var(--lavender)]/10">
                <Lightbulb
                  className="m-auto size-14 p-2 text-[var(--lavender)]
                             2xl:size-18 2xl:p-3"
                  strokeWidth={1}
                />
              </div>
              <p className="w-1/2 font-[family-name:var(--heading)] text-2xl
                            font-medium text-black 2xl:text-3xl">
                Перейти к задачам
              </p>
            </div>

            {/* Карточка — Перейти к тестовым */}
            <div className="flex h-auto flex-col gap-6 rounded-2xl bg-white
                            px-4 py-4 2xl:gap-8">
              <div className="w-fit rounded-lg bg-[var(--light-green)]/10">
                <Puzzle
                  className="m-auto size-14 p-2 text-[var(--light-green)]
                             2xl:size-18 2xl:p-3"
                  strokeWidth={1}
                />
              </div>
              <p className="w-1/2 font-[family-name:var(--heading)] text-2xl
                            font-medium text-black 2xl:text-3xl">
                Перейти к тестовым
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}