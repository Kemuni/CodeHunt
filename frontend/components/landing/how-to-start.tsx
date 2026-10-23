import { Lightbulb, FileText, Check, Ellipsis, Puzzle } from "lucide-react";
import {DoubleSlash} from "@/components/icons";

export function HowToStart() {
  return (
    <section
      className="flex w-full flex-col gap-6 overflow-hidden
                 2xl:gap-8"
      aria-labelledby="how-to-start-title"
    >
      {/* <div className="mx-auto flex w-[min(84%,1209px)] flex-col items-center">
        <p className="m-0 inline-flex items-center gap-1 text-base leading-[18px]
                      text-primary/50
                      2xl:text-lg 2xl:leading-[19px]">
          <DoubleSlash className="size-4" aria-hidden="true" />
          Основа
        </p>
        <h2
          id="how-to-start-title"
          className="m-0 mt-0.5 font-heading
                     text-[40px] font-medium leading-[1.05] tracking-[1px]
                     text-primary
                     2xl:text-[60px] 2xl:tracking-[1.2px]"
        >
          Как начать?
        </h2>
      </div> */}

      <div className="grid grid-cols-10 gap-2 px-10 2xl:px-40">
  {/* ─────────── Левый блок ─────────── */}
      <div
        className="relative col-span-7 flex h-auto flex-col gap-4 rounded-4xl
                  border overflow-hidden
                  w-[round(down,100%,var(--cell))]
                  bg-[linear-gradient(to_right,#cccccc4D_1px,transparent_1px),linear-gradient(to_bottom,#cccccc4D_1px,transparent_1px)]
                  bg-[size:var(--cell)_var(--cell)]
                  px-[var(--cell)] py-[var(--cell)]
                  2xl:gap-6"
      >
        {/* градиент поверх сетки */}
        <div className="pointer-events-none absolute inset-0
                        bg-[linear-gradient(to_left,#FFFFFF0D,#B6A2D44D)]"></div>

        {/* контент поверх градиента */}
        <div className="relative z-10 flex flex-col gap-4 2xl:gap-6">
          {/* Карточка 1 — Заполни профиль */}
          <div className="flex h-24 flex-row items-center gap-3 rounded-xl
                          border bg-white px-3 py-3
                          w-[round(up,100%,var(--cell))]
                          2xl:h-32 2xl:gap-4 2xl:px-4 2xl:py-4">
            <div className="inline-flex h-full aspect-square rounded-lg bg-primary/10">
              <FileText
                className="m-auto size-10 text-primary 2xl:size-14"
                strokeWidth={1}
              />
            </div>
            <div className="w-full text-black">
              <p className="font-heading text-lg font-medium 2xl:text-2xl">
                Заполни профиль
              </p>
              <p className="text-sm 2xl:text-base">
                Так работодатели узнают о тебе больше
              </p>
            </div>
            <div className="inline-flex h-1/2 aspect-square items-center
                            justify-center rounded-full bg-positive-green">
              <Check
                className="m-auto size-5 text-white 2xl:size-7"
                strokeWidth={2}
              />
            </div>
          </div>

          {/* Карточка 2 — Опиши портфолио */}
          <div className="flex h-24 flex-row items-center gap-3 rounded-xl
                          border bg-white px-3 py-3
                          w-[round(up,100%,var(--cell))]
                          2xl:h-32 2xl:gap-4 2xl:px-4 2xl:py-4">
            <div className="inline-flex h-full aspect-square rounded-lg bg-primary-pink/10">
              <Lightbulb
                className="m-auto size-10 text-primary-pink 2xl:size-14"
                strokeWidth={1}
              />
            </div>
            <div className="w-full text-black">
              <p className="font-heading text-lg font-medium 2xl:text-2xl">
                Опиши свое портфолио
              </p>
              <p className="text-sm 2xl:text-base">
                Так работодатели узнают о тебе больше
              </p>
            </div>
            <div className="inline-flex h-1/2 aspect-square items-center
                            justify-center rounded-full bg-positive-green">
              <Check
                className="m-auto size-5 text-white 2xl:size-7"
                strokeWidth={2}
              />
            </div>
          </div>

          {/* Карточка 3 — Сделай тестовое */}
          <div className="flex h-24 flex-row items-center gap-3 rounded-xl
                          border bg-white px-3 py-3
                          w-[round(up,100%,var(--cell))]
                          2xl:h-32 2xl:gap-4 2xl:px-4 2xl:py-4">
            <div className="inline-flex h-full aspect-square rounded-lg bg-dark-green/10">
              <Puzzle
                className="m-auto size-10 text-dark-green 2xl:size-14"
                strokeWidth={1}
              />
            </div>
            <div className="w-full text-black">
              <p className="font-heading text-lg font-medium 2xl:text-2xl">
                Сделай тестовое
              </p>
              <p className="text-sm 2xl:text-base">
                Так работодатели узнают о тебе больше
              </p>
            </div>
            <div className="inline-flex h-1/2 aspect-square items-center
                            justify-center rounded-full bg-warning-orange">
              <Ellipsis
                className="m-auto size-5 text-white 2xl:size-7"
                strokeWidth={2}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─────────── Правый блок ─────────── */}
      <div
        className="relative col-span-3 flex items-center rounded-4xl
                  border overflow-hidden
                  w-[round(down,100%,var(--cell))]
                  bg-[radial-gradient(transparent,#FFFFFFA4),radial-gradient(#B6A2D450,#FFFFFF20),url('/figma/DotGrid.svg')] bg-center
                  "
      >
        <div className="relative z-10 flex flex-col gap-4 px-4 py-4
                        2xl:gap-6 2xl:px-12 2xl:py-6">
          {/* Карточка — Перейти к задачам */}
          <div className="flex h-auto flex-col gap-4 rounded-xl bg-white
                          px-3 py-3 2xl:gap-6 2xl:px-4 2xl:py-4">
            <div className="w-fit rounded-lg bg-primary-pink/10">
              <Lightbulb
                className="m-auto size-10 p-1.5 text-primary-pink
                          2xl:size-14 2xl:p-2"
                strokeWidth={1}
              />
            </div>
            <p className="w-fit font-heading text-lg font-medium text-black
                          2xl:text-2xl">
              Перейти к задачам
            </p>
          </div>

          {/* Карточка — Перейти к тестовым */}
          <div className="flex h-auto flex-col gap-4 rounded-xl bg-white
                          px-3 py-3 2xl:gap-6 2xl:px-4 2xl:py-4">
            <div className="w-fit rounded-lg bg-dark-green/10">
              <Puzzle
                className="m-auto size-10 p-1.5 text-dark-green
                          2xl:size-14 2xl:p-2"
                strokeWidth={1}
              />
            </div>
            <p className="w-fit font-heading text-lg font-medium text-black
                          2xl:text-2xl">
              Перейти к тестовым
            </p>
          </div>
        </div>
      </div>
    </div>
    </section>
  );
}