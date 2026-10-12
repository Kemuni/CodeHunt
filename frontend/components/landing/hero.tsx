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

const leftBadges = [
  { className: "left-[28px] top-0", label: "Сделать портфолио" },
  { className: "right-0 top-[96px]", label: "Проявить себя" },
  { className: "left-0 top-[188px]", label: "Развить насмотренность" },
  { className: "bottom-0 right-[8px]", label: "Найти работу" },
];

const rightBadges = [
  { className: "left-0 top-0", label: "Найти сотрудника" },
  { className: "left-[156px] top-[96px]", label: "Создать тестовое" },
  { className: "left-[42px] top-[176px]", label: "Быстро оценить" },
  { className: "bottom-0 left-[124px]", label: "Убедиться в навыках" },
];

const decorations = [
  { className: "left-[293px] top-[64px]", height: 80, src: "/figma/Asterisk 2.svg", width: 160 },
  { className: "bottom-[166px] left-[54px]", height: 102, src: "/figma/Asterisk 2.svg", width: 143 },
  { className: "bottom-[156px] right-[88px]", height: 120, src: "/figma/Rhode Island.svg", width: 120 },
  { className: "bottom-[37px] right-[200px]", height: 80, src: "/figma/Teewee.svg", width: 180 },
  { className: "right-[46px] top-[52px]", height: 84, src: "/figma/Butterfly.svg", width: 124 },
  { className: "bottom-[35px] left-[289px]", height: 103, src: "/figma/Orange Ricky.svg", width: 193 },
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
    const timeout = window.setTimeout(() => {
      if (isComplete) {
        setIndex((currentIndex) => (currentIndex + 1) % prompts.length);
        setLength(0);
        return;
      }

      setLength((currentLength) => currentLength + 1);
    }, isComplete ? 1800 : 52);

    return () => window.clearTimeout(timeout);
  }, [length, phrase.length, reducedMotion]);

  return (
    <div className="absolute left-1/2 top-[196px] z-[2] w-[600px] -translate-x-1/2 whitespace-nowrap text-center text-2xl leading-[37px] text-[var(--lavender)]">
      <motion.span initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}>
        {reducedMotion ? phrase : phrase.slice(0, length)}
      </motion.span>
      <i
        className="ml-[8px] inline-block h-[37px] w-px align-middle bg-[var(--lavender)] motion-safe:[animation:blink_1s_steps(1)_infinite]"
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
          className={`absolute whitespace-nowrap rounded-2xl border border-[rgb(38_6_134_/_50%)] bg-white px-5 py-3 text-2xl font-semibold leading-7 text-[var(--ink)] ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative mx-auto h-[calc(100dvh-94px)] min-h-[820px] w-[calc(100vw-64px)] min-w-[1376px] max-w-[1920px] isolate">
      <p className="absolute left-1/2 top-[164px] m-0 w-[380px] -translate-x-1/2 text-center text-lg leading-[22px] text-[var(--muted)]">
        Решим все ваши
      </p>
      <Typewriter />

      <div className="absolute left-1/2 top-[328px] z-[2] w-[790px] -translate-x-1/2 text-center">
        <h1 className="m-0 font-[family-name:var(--heading)] text-[64px] font-medium leading-[1.22] tracking-[4.8px]">
          ТАМ, ГДЕ{" "}
          <span className="ml-[18px] inline-block rounded-full bg-[var(--ink)] px-8 py-1 tracking-[3px] text-white">
            ИДЕИ
          </span>
          <br />
          НАХОДЯТ ЛЮДЕЙ
        </h1>
        <p className="m-[24px_auto_0] w-[760px] text-[28px] leading-8 text-black">
          Объединяем соискателей и нанимателей в едином честном пространстве
        </p>
      </div>

      <BadgeGroup badges={leftBadges} className="absolute -left-[103px] top-[170px] z-[2] h-[342px] w-[500px]" />
      <BadgeGroup badges={rightBadges} className="absolute right-[18px] top-[170px] z-[2] h-[342px] w-[500px]" />

      <AnimatedArrow direction="left" />
      <AnimatedArrow direction="right" />

      {decorations.map((decoration) => (
        <Image
          key={decoration.className}
          className={`pointer-events-none absolute z-[1] ${decoration.className}`}
          src={decoration.src}
          alt=""
          width={decoration.width}
          height={decoration.height}
          aria-hidden="true"
        />
      ))}

      <div className="absolute top-2/3 left-1/2 z-[3] flex -translate-x-1/2 gap-7">
        <a
          className="inline-flex min-h-14 min-w-[236px] items-center justify-center gap-3 rounded-full border border-[var(--ink)] bg-[var(--ink)] px-9 py-3 text-2xl font-medium leading-7 whitespace-nowrap text-white"
          href="#practice"
        >
          Каталог задач
          <ArrowRight aria-hidden="true" />
        </a>
        <a
          className="inline-flex min-h-14 min-w-[236px] items-center justify-center rounded-full border border-[var(--ink)] bg-transparent px-9 py-3 text-2xl font-semibold leading-7 whitespace-nowrap"
          href="#contact"
        >
          Для компаний
        </a>
      </div>
    </section>
  );
}
