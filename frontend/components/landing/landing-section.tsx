import React from "react";
import {DoubleSlash} from "@/components/icons";
import {cn} from "cn";

interface LandingSection extends React.ComponentProps<"div"> {
  subtitle: string
  title: string
  classname?: string
}


export function LandingSection({ subtitle, title, classname, children}: LandingSection) {
  return (
    <div className={cn("relative w-full flex flex-col items-center gap-6", classname)}>
      <span className="flex flex-col w-fit">
        <p className="m-auto inline-flex items-center gap-1 text-primary/50 font-light">
          <DoubleSlash className="size-4" aria-hidden="true"/>
          {subtitle}
        </p>
        <h2
          className="font-heading text-5xl font-medium tracking-wide text-primary"
        >
          {title}
        </h2>
      </span>
      {children}
    </div>
  );
}
