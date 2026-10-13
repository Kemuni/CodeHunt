import { Lightbulb, FileText, Check, Ellipsis, Puzzle } from "lucide-react";


export function HowToStart() {
  return (
    <section className="overflow-hidden pb-20 pt-8 gap-8 flex flex-col" aria-labelledby="company-marquee-title" >
      <div className="mx-auto flex w-[min(84%,1209px)] flex-col items-center">
        <p className="m-0 inline-flex items-center gap-2 text-lg leading-[19px] text-[var(--muted)]">
          <Lightbulb className="size-4 text-[var(--lavender)]" strokeWidth={2} aria-hidden="true" />
          Основа
        </p>
        <h2
          id="company-marquee-title"
          className="m-0 mt-0.5 font-[family-name:var(--heading)] text-[60px] font-medium leading-[1.05] tracking-[1.2px] text-[var(--ink)]"
        >
          Как начать?
        </h2>
      </div>
      <div className="grid grid-cols-10 gap-2 px-40">
        {/* Этот блок начиная можно потом забрать в "Как мы помогаем", только поменять немного надо */}
        <div className="relative flex flex-col gap-10 col-span-7 rounded-2xl h-auto
              border border-[var(--grid)] overflow-hidden
              w-[round(down,100%,var(--cell))]
              bg-[linear-gradient(to_right,var(--grid)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid)_1px,transparent_1px)]
              bg-[size:var(--cell)_var(--cell)]
              px-[var(--cell)] py-[var(--cell)]">

          {/* градиент справа налево: #B6A2D480 → #FFFFFF */}
          <div className="absolute inset-0 pointer-events-none
                          bg-[linear-gradient(to_left,#FFFFFF0D,#B6A2D44D)]"></div>

          {/* контент поверх градиента */}
          <div className="relative z-10 flex flex-col gap-10">

            <div className="flex flex-row bg-white h-40 rounded-2xl px-4 py-4 border border-[var(--grid)] w-[round(up,100%,var(--cell))] gap-6 items-center">
              <div className="inline-flex h-full aspect-square bg-[var(--ink)]/10 rounded-lg">
                <FileText className="w-[70%] h-[70%] m-auto text-[var(--ink)]" strokeWidth={1}/>
              </div>
              <div className="text-black font-medium w-full">
                <p className="font-[family-name:var(--heading)] text-3xl">
                  Заполни профиль
                </p>
                <p className="font-[family-name:var(--body)] text-xl">
                  Так работодатели узнают о тебе больше
                </p>
              </div>
              <div className="inline-flex h-1/2 aspect-square rounded-full bg-[var(--green-check)] items-center justify-center">
                <Check className="text-white w-[70%] h-[70%] m-auto" strokeWidth={2}/>
              </div>
            </div>

            <div className="flex flex-row bg-white h-40 rounded-2xl px-4 py-4 border border-[var(--grid)] w-[round(up,100%,var(--cell))] gap-6 items-center">
              <div className="inline-flex h-full aspect-square bg-[var(--lavender)]/10 rounded-lg">
                <Lightbulb className="w-[70%] h-[70%] m-auto text-[var(--lavender)]" strokeWidth={1}/>
              </div>
              <div className="text-black font-medium w-full">
                <p className="font-[family-name:var(--heading)] text-3xl">
                  Опиши свое портфолио
                </p>
                <p className="font-[family-name:var(--body)] text-xl">
                  Так работодатели узнают о тебе больше
                </p>
              </div>
              <div className="inline-flex h-1/2 aspect-square rounded-full bg-[var(--green-check)] items-center justify-center">
                <Check className="text-white w-[70%] h-[70%] m-auto" strokeWidth={2}/>
              </div>
            </div>

            <div className="flex flex-row bg-white h-40 rounded-2xl px-4 py-4 border border-[var(--grid)] w-[round(up,100%,var(--cell))] gap-6 items-center">
              <div className="inline-flex h-full aspect-square bg-[var(--light-green)]/10 rounded-lg">
                <Puzzle className="w-[70%] h-[70%] m-auto text-[var(--light-green)]" strokeWidth={1}/>
              </div>
              <div className="text-black font-medium w-full">
                <p className="font-[family-name:var(--heading)] text-3xl">
                  Сделай тестовое
                </p>
                <p className="font-[family-name:var(--body)] text-xl">
                  Так работодатели узнают о тебе больше
                </p>
              </div>
              <div className="inline-flex h-1/2 aspect-square rounded-full bg-[var(--orange-dots)] items-center justify-center">
                <Ellipsis className="text-white w-[70%] h-[70%] m-auto" strokeWidth={2}/>
              </div>
            </div>

          </div>
        </div>
        {/* Конец блока */}
        <div className="relative col-span-3 rounded-2xl
              bg-[radial-gradient(circle,var(--grid)_4px,transparent_1px)]
              bg-[size:30px_30px]
              border border-[var(--grid)] overflow-hidden
              w-[round(down,100%,var(--cell))]">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_left,#FFFFFF0D,#B6A2D44D)]"></div>
          <div className="relative z-10 flex flex-col gap-10">
            <div className="bg-white h-10">

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}