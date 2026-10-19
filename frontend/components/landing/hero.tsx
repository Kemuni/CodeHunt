"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { AnimatedArrow } from "@/components/landing/animated-arrow";
import {Button} from "@/components/ui/button";
import Link from "next/link";

const prompts = [
  "Не знаю с чего начать...",
  "Где взять идею...",
  "Как устроиться на работу...",
  "Как собрать сильное портфолио...",
  "Как подготовиться к собеседованию...",
];

const leftBadges = [
  {
    className: "left-5 top-0 2xl:left-7",
    label: "Сделать портфолио",
  },
  {
    className: "right-0 top-16 2xl:top-20",
    label: "Проявить себя",
  },
  {
    className: "left-0 top-32 2xl:top-40",
    label: "Развить насмотренность",
  },
  {
    className: "bottom-0 right-30 2xl:right-22",
    label: "Найти работу",
  },
];

const rightBadges = [
  {
    className: "left-0 top-0",
    label: "Найти сотрудника",
  },
  {
    className: "left-28 top-16 2xl:left-34 2xl:top-20",
    label: "Создать тестовое",
  },
  {
    className: "left-8 top-34 2xl:left-9 2xl:top-37",
    label: "Быстро оценить",
  },
  {
    className: "bottom-0 left-24 2xl:left-27",
    label: "Убедиться в навыках",
  },
];

const decorations = [
  {
    className: "left-56 w-44 top-12 2xl:left-[340px] 2xl:top-14 h-auto",
    height: 0,
    src: "/figma/Asterisk 2.svg",
    width: 0,
    hideOnMobile: false,
  },
  {
    className: "bottom-32 w-44 left-12 2xl:bottom-[140px] 2xl:left-[46px] h-auto",
    height: 0,
    src: "/figma/Asterisk 2.svg",
    width: 0,
    hideOnMobile: true,
  },
  {
    className: "bottom-32 w-44 right-10 2xl:bottom-[132px] 2xl:right-[74px] h-auto",
    height: 0,
    src: "/figma/Rhode Island.svg",
    width: 0,
    hideOnMobile: false,
  },
  {
    className: "bottom-5 w-60 right-40 2xl:bottom-[32px] 2xl:right-[170px] h-auto",
    height: 0,
    src: "/figma/Teewee.svg",
    width: 0,
    hideOnMobile: true,
  },
  {
    className: "right-10 top-12 w-44 2xl:right-[40px] 2xl:top-[44px] h-auto",
    height: 0,
    src: "/figma/Butterfly.svg",
    width: 0,
    hideOnMobile: false,
  },
  {
    className: "bottom-0 left-50 w-56 2xl:bottom-[30px] 2xl:left-[245px] h-auto",
    height: 0,
    src: "/figma/Orange Ricky.svg",
    width: 0,
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
                 2xl:top-[176px] 2xl:w-[540px] 2xl:text-xl 2xl:leading-[33px]"
    >
      <motion.span initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}>
        {reducedMotion ? phrase : phrase.slice(0, length)}
      </motion.span>
      <i
        className="ml-2 inline-block h-8 w-px align-middle bg-primary-pink
                   motion-safe:animate-[blink_1s_steps(1)_infinite]
                   2xl:h-8"
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
                      2xl:px-4 2xl:py-2.5 2xl:text-xl 2xl:leading-6
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
      <p
        className="absolute left-1/2 top-[120px] m-0 w-[320px] -translate-x-1/2
                   text-center text-base leading-5 text-muted-foreground
                   2xl:top-[148px] 2xl:w-[340px] 2xl:text-base 2xl:leading-[20px]"
      >
        Решим все ваши
      </p>

      <Typewriter />

      <div
        className="absolute left-1/2 top-[240px] z-[2] w-[640px] -translate-x-1/2
                   text-center
                   2xl:top-[300px] 2xl:w-[700px]"
      >
        <h1
          className="m-0 font-heading font-medium
                     text-[44px] leading-[1.22] tracking-[3px]
                     2xl:text-[54px] 2xl:tracking-[4px]"
        >
          ТАМ, ГДЕ{" "}
          <span
            className="ml-3 inline-block rounded-full bg-primary
                       px-6 py-1 tracking-[2px] text-white
                       2xl:ml-[16px] 2xl:px-7 2xl:tracking-[2.5px]"
          >
            ИДЕИ
          </span>
          <br />
          НАХОДЯТ ЛЮДЕЙ
        </h1>
        <p
          className="mx-auto mt-4 w-[600px] text-xl leading-7 text-black
                     2xl:mt-5 2xl:w-[660px] 2xl:text-2xl 2xl:leading-7"
        >
          Объединяем соискателей и нанимателей в едином честном пространстве
        </p>
      </div>

      <BadgeGroup
        badges={leftBadges}
        className="absolute -left-2 top-[140px] z-[2] hidden
                   h-[280px] w-[420px]
                   2xl:top-[160px] 2xl:h-[300px] 2xl:w-[440px] xl:block"
      />
      <BadgeGroup
        badges={rightBadges}
        className="absolute right-4 top-[140px] z-[2] hidden
                   h-[280px] w-[420px]
                   2xl:top-[160px] 2xl:h-[300px] 2xl:w-[440px] xl:block"
      />

      <div className="absolute hidden xl:block inset-x-0 top-0 z-[1] h-full 2xl:-translate-y-16">
        <AnimatedArrow direction="left" />
        <AnimatedArrow direction="right" />
      </div>

      {decorations.map((decoration) => (
        <Image
          key={decoration.className}
          className={`pointer-events-none absolute z-[1]
                      scale-75 2xl:scale-90
                      ${decoration.hideOnMobile ? "hidden md:block" : ""}
                      ${decoration.className}`}
          src={decoration.src}
          alt=""
          width={decoration.width}
          height={decoration.height}
          aria-hidden="true"
        />
      ))}

      <div
        className="absolute left-1/2 bottom-[10%] z-[3] flex -translate-x-1/2
                   gap-5 2xl:top-[79%] 2xl:gap-6"
      >
        <Link href="/tasks">
          <Button variant='default' size='xl'>
            Каталог задач
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </Link>
        <Link href="/for-company">
          <Button variant='outline' size='xl'>
            Для компаний
          </Button>
        </Link>
      </div>
    </section>
  );
}