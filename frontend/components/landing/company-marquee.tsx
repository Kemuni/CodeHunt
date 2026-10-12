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
    <section className="overflow-hidden pb-20 pt-8" aria-labelledby="company-marquee-title" >
      <div className="mx-auto flex w-[min(84%,1209px)] flex-col items-center">
        <p className="m-0 inline-flex items-center gap-2 text-lg leading-[19px] text-[var(--muted)]">
          <Lightbulb className="size-4 text-[var(--lavender)]" strokeWidth={2} aria-hidden="true" />
          Совершенствуемся решая
        </p>
        <h2
          id="company-marquee-title"
          className="m-0 mt-0.5 font-[family-name:var(--heading)] text-[60px] font-medium leading-[1.05] tracking-[1.2px] text-[var(--ink)]"
        >
          Задачи Big Tech компаний
        </h2>
      </div>

      <div className="mt-18 w-full overflow-hidden" aria-label="Компании, задачи которых представлены на платформе">
        <div className="flex w-max motion-safe:animate-[marquee_24s_linear_infinite_reverse] motion-reduce:animate-none">
          <CompanyLogos />
          <CompanyLogos isDuplicate />
          <CompanyLogos isDuplicate />
          <CompanyLogos isDuplicate />
        </div>
      </div>
    </section>
  );
}
