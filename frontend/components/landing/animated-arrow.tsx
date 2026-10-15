"use client";

import { motion, useReducedMotion } from "motion/react";

type AnimatedArrowProps = {
  direction: "left" | "right";
};

const arrowPaths = {
  left: "M 3 3 C 8 35, 25 70, 58 88 C 88 105, 120 102, 160 84 C 180 74, 177 51, 161 51 C 142 50, 120 73, 110 96 C 101 117, 116 139, 145 151 C 180 165, 218 176, 246 179",
  right: "M 296 3 C 304 22, 310 48, 295 75 C 269 106, 232 110, 199 100 C 176 92, 158 82, 134 100 C 116 116, 99 150, 87 164 C 68 183, 53 186, 35 186",
};

const arrowHeads = {
  left: "M 258 164 L 276 181 L 258 199",
  right: "M 21 169 L 3 185 L 19 201",
};

export function AnimatedArrow({ direction }: AnimatedArrowProps) {
  const reducedMotion = useReducedMotion();
  const isLeft = direction === "left";
  const width = isLeft ? 279 : 309;
  const height = isLeft ? 200 : 205;

  return (
    <svg
      className={
        isLeft
          ? "pointer-events-none absolute left-[190px] top-[440px] z-[1] origin-top-left scale-100 text-primary 2xl:left-[292px] 2xl:top-[548px] 2xl:scale-[1.2]"
          : "pointer-events-none absolute right-[170px] top-[440px] z-[1] origin-top-right scale-100 text-primary 2xl:right-[254px] 2xl:top-[545px] 2xl:scale-[1.2]"
      }
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      aria-hidden="true"
    >
      <motion.path
        d={arrowPaths[direction]}
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
        strokeDasharray="25 25"
        animate={reducedMotion ? undefined : { strokeDashoffset: [0, -50] }}
        transition={
          reducedMotion
            ? undefined
            : {
                duration: 1.4,
                ease: "linear",
                repeat: Infinity,
              }
        }
      />
      <path
        d={arrowHeads[direction]}
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}