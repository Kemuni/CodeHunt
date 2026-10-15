"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { AnimatedArrow } from "@/components/landing/animated-arrow";

const prompts = [
  "Не знаю с чего начать...",
  "Где взять идею...",
  "Как устроиться на работу...",
  "Как собрать сильное портфолио...",
  "Как подготовиться к собеседованию...",
];

/* ─────────── Бейджи ───────────
   top/left/right/bottom — ноут по умолчанию,
   2xl: — значения из макета 1920
*/
const leftBadges = [
  {
    className: "left-5 top-0 2xl:left-7",
    label: "Сделать портфолио",
  },
  {
    className: "right-0 top-16 2xl:top-24",
    label: "Проявить себя",
  },
  {
    className: "left-0 top-32 2xl:top-47",
    label: "Развить насмотренность",
  },
  {
    className: "bottom-0 right-16 2xl:right-25",
    label: "Найти работу",
  },
];

const rightBadges = [
  {
    className: "left-0 top-0",
    label: "Найти сотрудника",
  },
  {
    className: "left-28 top-16 2xl:left-39 2xl:top-24",
    label: "Создать тестовое",
  },
  {
    className: "left-8 top-28 2xl:left-10 2xl:top-44",
    label: "Быстро оценить",
  },
  {
    className: "bottom-0 left-24 2xl:left-31",
    label: "Убедиться в навыках",
  },
];

/* ─────────── Декорации ─────────── */
const decorations = [
  {
    className: "left-56 top-12 2xl:left-[393px] 2xl:top-16",
    height: 80,
    src: "/figma/Asterisk 2.svg",
    width: 160,
    hideOnMobile: false,
  },
  {
    className: "bottom-32 left-12 2xl:bottom-[166px] 2xl:left-[54px]",
    height: 102,
    src: "/figma/Asterisk 2.svg",
    width: 143,
    hideOnMobile: true,
  },
  {
    className: "bottom-32 right-16 2xl:bottom-[156px] 2xl:right-[88px]",
    height: 120,
    src: "/figma/Rhode Island.svg",
    width: 120,
    hideOnMobile: false,
  },
  {
    className: "bottom-8 right-40 2xl:bottom-[37px] 2xl:right-[200px]",
    height: 80,
    src: "/figma/Teewee.svg",
    width: 180,
    hideOnMobile: true,
  },
  {
    className: "right-10 top-12 2xl:right-[46px] 2xl:top-[52px]",
    height: 84,
    src: "/figma/Butterfly.svg",
    width: 124,
    hideOnMobile: false,
  },
  {
    className: "bottom-8 left-56 2xl:bottom-[35px] 2xl:left-[289px]",
    height: 103,
    src: "/figma/Orange Ricky.svg",
    width: 193,
    hideOnMobile: true,
  },
];

type Badge = {
  className: string;
  label: string;
};

type BadgeGroupProps = {
  badges: Badge[];
  className: string;
};

function Typewriter() {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(0);
  const phrase = prompts[index];

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    const isComplete = length === phrase.length;
    const timeout = window.setTimeout(
      () => {
        if (isComplete) {
          setIndex((currentIndex) => (currentIndex + 1) % prompts.length);
          setLength(0);
          return;
        }

        setLength((currentLength) => currentLength + 1);
      },
      isComplete ? 1800 : 52,
    );

    return () => window.clearTimeout(timeout);
  }, [length, phrase.length, reducedMotion]);

  return (
    <div
      className="absolute left-1/2 top-[164px] z-[2] w-[520px] -translate-x-1/2
                 whitespace-nowrap text-center text-xl leading-[32px]
                 text-primary-pink
                 2xl:top-[196px] 2xl:w-[600px] 2xl:text-2xl 2xl:leading-[37px]"
    >
      <motion.span initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}>
        {reducedMotion ? phrase : phrase.slice(0, length)}
      </motion.span>
      <i
        className="ml-2 inline-block h-8 w-px align-middle bg-primary-pink
                   motion-safe:animate-[blink_1s_steps(1)_infinite]
                   2xl:h-[37px]"
        aria-hidden="true"
      />
    </div>
  );
}

function BadgeGroup({ badges, className }: BadgeGroupProps) {
  return (
    <div className={className}>
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`absolute whitespace-nowrap rounded-2xl
                      border border-[rgb(38_6_134_/_50%)] bg-white
                      px-4 py-2 text-lg font-semibold leading-6
                      text-primary
                      2xl:px-5 2xl:py-3 2xl:text-2xl 2xl:leading-7
                      ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

export function Hero() {
  return (
    <section
      className="relative isolate px-auto
                 h-[calc(100dvh-94px)] min-h-[680px]
                 w-[calc(100vw-64px)] max-w-full
                 min-w-[1024px]
                 2xl:min-h-[820px]"
    >
      {/* «Решим все ваши» */}
      <p
        className="absolute left-1/2 top-[120px] m-0 w-[320px] -translate-x-1/2
                   text-center text-base leading-5 text-muted-foreground
                   2xl:top-[164px] 2xl:w-[380px] 2xl:text-lg 2xl:leading-[22px]"
      >
        Решим все ваши
      </p>

      <Typewriter />

      {/* Заголовок и подзаголовок */}
      <div
        className="absolute left-1/2 top-[240px] z-[2] w-[640px] -translate-x-1/2
                   text-center
                   2xl:top-[328px] 2xl:w-[790px]"
      >
        <h1
          className="m-0 font-heading font-medium
                     text-[44px] leading-[1.22] tracking-[3px]
                     2xl:text-[64px] 2xl:tracking-[4.8px]"
        >
          ТАМ, ГДЕ{" "}
          <span
            className="ml-3 inline-block rounded-full bg-primary
                       px-6 py-1 tracking-[2px] text-white
                       2xl:ml-[18px] 2xl:px-8 2xl:tracking-[3px]"
          >
            ИДЕИ
          </span>
          <br />
          НАХОДЯТ ЛЮДЕЙ
        </h1>
        <p
          className="mx-auto mt-4 w-[600px] text-xl leading-7 text-black
                     2xl:mt-6 2xl:w-[760px] 2xl:text-[28px] 2xl:leading-8"
        >
          Объединяем соискателей и нанимателей в едином честном пространстве
        </p>
      </div>

      {/* Бейджи — только от lg */}
      <BadgeGroup
        badges={leftBadges}
        className="absolute -left-2 top-[140px] z-[2] hidden
                   h-[280px] w-[420px]
                   2xl:top-[170px] 2xl:h-[342px] 2xl:w-[500px] lg:block"
      />
      <BadgeGroup
        badges={rightBadges}
        className="absolute right-4 top-[140px] z-[2] hidden
                   h-[280px] w-[420px]
                   2xl:top-[170px] 2xl:h-[342px] 2xl:w-[500px] lg:block"
      />

      <AnimatedArrow direction="left" />
      <AnimatedArrow direction="right" />

      {/* Декорации */}
      {decorations.map((decoration) => (
        <Image
          key={decoration.className}
          className={`pointer-events-none absolute z-[1]
                      scale-75 2xl:scale-100
                      ${decoration.hideOnMobile ? "hidden md:block" : ""}
                      ${decoration.className}`}
          src={decoration.src}
          alt=""
          width={decoration.width}
          height={decoration.height}
          aria-hidden="true"
        />
      ))}

      {/* Кнопки */}
      <div
        className="absolute left-1/2 top-[70%] z-[3] flex -translate-x-1/2
                   gap-5 2xl:top-[86%] 2xl:gap-7"
      >
        <a
          className="inline-flex min-h-12 min-w-[190px] items-center justify-center
                     gap-2 rounded-full border border-primary bg-primary
                     px-6 py-2 text-xl font-medium leading-6 whitespace-nowrap
                     text-white
                     2xl:min-h-14 2xl:min-w-[236px] 2xl:gap-3
                     2xl:px-9 2xl:py-3 2xl:text-2xl 2xl:leading-7"
          href="#practice"
        >
          Каталог задач
          <ArrowRight aria-hidden="true" />
        </a>
        <a
          className="inline-flex min-h-12 min-w-[190px] items-center justify-center
                     rounded-full border border-primary bg-transparent
                     px-6 py-2 text-xl font-semibold leading-6 whitespace-nowrap
                     2xl:min-h-14 2xl:min-w-[236px]
                     2xl:px-9 2xl:py-3 2xl:text-2xl 2xl:leading-7"
          href="#contact"
        >
          Для компаний
        </a>
      </div>
    </section>
  );
}