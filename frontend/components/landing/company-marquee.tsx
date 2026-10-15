import Image from "next/image";

import { Lightbulb } from "lucide-react";

const companies = [
  {
    alt: "ВКонтакте",
    height: 60,
    src: "/figma/company-logos/vk.svg",
    width: 345,
  },
  {
    alt: "Ozon",
    height: 60,
    src: "/figma/company-logos/ozon.svg",
    width: 275,
  },
  {
    alt: "Авито",
    height: 60,
    src: "/figma/company-logos/avito.svg",
    width: 237,
  },
  {
    alt: "Яндекс",
    height: 60,
    src: "/figma/company-logos/yandex.svg",
    width: 207,
  },
  {
    alt: "Wildberries",
    height: 60,
    src: "/figma/company-logos/wildberries.svg",
    width: 387,
  },
];

type CompanyLogosProps = {
  isDuplicate?: boolean;
};

function CompanyLogos({ isDuplicate = false }: CompanyLogosProps) {
  return (
    <div className="flex shrink-0 items-center gap-[72px] pr-[72px]" aria-hidden={isDuplicate}>
      {companies.map((company) => (
        <Image
          key={company.src}
          className="h-[72px] w-auto shrink-0"
          src={company.src}
          alt={company.alt}
          width={company.width}
          height={company.height}
        />
      ))}
    </div>
  );
}

export function CompanyMarquee() {
  return (
    <section className="flex flex-col overflow-hidden pb-20 pt-8 gap-20 w-full" aria-labelledby="company-marquee-title" >
      <div className="mx-auto flex w-[min(84%,1209px)] flex-col items-center">
        <p className="m-0 inline-flex items-center gap-2 text-lg leading-[19px] text-[var(--lavender)]">
          <Lightbulb className="size-4" strokeWidth={2} aria-hidden="true" />
          Совершенствуемся решая
        </p>
        <h2
          id="company-marquee-title"
          className="m-0 mt-0.5 font-[family-name:var(--heading)] text-[60px] font-medium leading-[1.05] tracking-[1.2px] text-[var(--ink)]"
        >
          Задачи Big Tech компаний
        </h2>
      </div>

      <div className="w-full overflow-hidden" aria-label="Компании, задачи которых представлены на платформе">
        <div className="flex w-max motion-safe:animate-[marquee_24s_linear_infinite_reverse] motion-reduce:animate-none">
          <CompanyLogos />
          <CompanyLogos isDuplicate />
          <CompanyLogos isDuplicate />
          <CompanyLogos isDuplicate />
        </div>
      </div>
      <div className="flex px-10 2xl:px-40">
        <div className="relative isolate flex h-fit w-full flex-col gap-5 overflow-hidden
                        rounded-2xl bg-black px-10 py-8">

          {/* ─── Декорации ─── */}
          <div className="pointer-events-none absolute left-[92.4%] top-16 z-0 w-full">
            <Image
              className="absolute left-0 top-0 hidden w-33 -translate-x-1/2 -translate-y-1/2
                        md:block 2xl:w-37"
              src="/figma/company-marquee/Asterisk 3.svg"
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

          <div className="pointer-events-none absolute left-[50.4%] bottom-14 z-0 w-full">
            <Image
              className="absolute left-0 top-0 hidden w-33 -translate-x-1/2 -translate-y-1/2
                        md:block 2xl:w-37"
              src="/figma/company-marquee/Asterisk 1 CM.svg"
              alt=""
              width={132}
              height={131}
              aria-hidden="true"
            />
            <Image
              className="absolute left-0 top-0 hidden w-54 -translate-x-1/2 -translate-y-1/2
                        lg:block 2xl:w-[245px]"
              src="/figma/company-marquee/Asterisk 1 CM.svg"
              alt=""
              width={217}
              height={216}
              aria-hidden="true"
            />
          </div>

          <div className="pointer-events-none absolute left-[40.4%] top-14 z-0 w-full">
            <Image
              className="absolute left-0 top-0 hidden w-33 -translate-x-1/2 -translate-y-1/2
                        md:block 2xl:w-37"
              src="/figma/company-marquee/Teewee CM.svg"
              alt=""
              width={132}
              height={131}
              aria-hidden="true"
            />
            <Image
              className="absolute left-0 top-0 hidden w-54 -translate-x-1/2 -translate-y-1/2
                        lg:block 2xl:w-[245px]"
              src="/figma/company-marquee/Teewee CM.svg"
              alt=""
              width={217}
              height={216}
              aria-hidden="true"
            />
          </div>

          {/* ─── Контент ─── */}
          <p className="relative z-10 m-0 inline-flex items-center gap-2 text-lg
                        font-light leading-[19px] text-white font-[family-name:var(--body)]">
            <Lightbulb className="size-6 text-[var(--lavender)]" strokeWidth={2} aria-hidden="true" />
            Почему мы
          </p>
          <h2 className="relative z-10 m-0 mt-0.5 w-2/5 font-[family-name:var(--heading)]
                        text-[40px] font-normal leading-[1.05] tracking-[1.2px] text-white">
            Помогаем по-настоящему проявить себя
          </h2>

          <div className="relative z-10 flex flex-row justify-between pe-20">
            <div className="flex w-1/2 flex-col border-b border-white/15 pb-2">
              <p className="font-[family-name:var(--heading)] text-[20px] font-medium text-[var(--lavender)]">001</p>
              <p className="font-[family-name:var(--heading)] text-[20px] font-medium text-white">Найдем задачи</p>
              <p className="font-[family-name:var(--body)] text-[16px] font-normal text-white">
                Решая которые ты сможешь не только показать свои способности, но и улучшить их, благодаря целому каталогу.
              </p>
            </div>
            <div className="flex w-2/5 flex-col border-b border-white/15 pb-2">
              <p className="font-[family-name:var(--heading)] text-[20px] font-medium text-[var(--lavender)]">002</p>
              <p className="font-[family-name:var(--heading)] text-[20px] font-medium text-white">Составим портфолио</p>
              <p className="font-[family-name:var(--body)] text-[16px] font-normal text-white">
                С помощью которого компании смогут по достоинству оценить тебя, благодаря более подробному описанию резюме и интересным задачам.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-row justify-between pe-20">
            <div className="flex w-1/2 flex-col border-b border-white/15 pb-2">
              <p className="font-[family-name:var(--heading)] text-[20px] font-medium text-[var(--lavender)]">003</p>
              <p className="font-[family-name:var(--heading)] text-[20px] font-medium text-white">Покажем тестовые компаний</p>
              <p className="font-[family-name:var(--body)] text-[16px] font-normal text-white">
                Решая которые ты сможешь доказать навыки, а наниматели смогут увидеть их и предложить тебе оффер.
              </p>
            </div>
            <div className="flex w-2/5 flex-col border-b border-white/15 pb-2">
              <p className="font-[family-name:var(--heading)] text-[20px] font-medium text-[var(--lavender)]">004</p>
              <p className="font-[family-name:var(--heading)] text-[20px] font-medium text-white">Продвинем тебя</p>
              <p className="font-[family-name:var(--body)] text-[16px] font-normal text-white">
                С помощью которого компании смогут по достоинству оценить тебя, благодаря более подробному описанию резюме и интересным задачам.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
