import React, {HTMLAttributes} from "react";
import {cn} from "cn";


export interface SectionLayoutProps extends HTMLAttributes<HTMLDivElement> {}

export const SectionLayout: React.FC<SectionLayoutProps> = ({
  children, className, ...props
}) => {

  return (
    <div className={cn("w-full bg-white px-6 py-4 xl:px-9 xl:py-6 rounded-2xl shadow-sm border", className)} {...props}>
      { children }
    </div>
  );
}

export interface SectionLayoutHeaderProps extends HTMLAttributes<HTMLHeadingElement> {}

export const SectionLayoutHeader: React.FC<SectionLayoutHeaderProps> = ({
  children, className, ...props
}) => {

  return (
    <h2 className={cn("text-4xl font-heading font-medium tracking-wider", className)} {...props}>
      { children }
    </h2>
  );
}


export interface SectionLayoutDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export const SectionLayoutDescription: React.FC<SectionLayoutDescriptionProps> = ({
  children, className, ...props
}) => {

  return (
    <p className={cn("text-muted-foreground text-base font-normal mt-1", className)} {...props}>
      { children }
    </p>
  );
}


export interface SectionLayoutContentProps extends HTMLAttributes<HTMLDivElement> {}

export const SectionLayoutContent: React.FC<SectionLayoutContentProps> = ({
  children, className, ...props
}) => {

  return (
    <div className={cn("w-full mt-5 flex flex-col", className)} {...props}>
      { children }
    </div>
  );
}
