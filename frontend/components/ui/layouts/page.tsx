import React, {HTMLAttributes} from "react";
import {cn} from "cn";


export interface PageLayoutProps extends HTMLAttributes<HTMLDivElement> {}

/** Задаёт внешние адаптивные отступы страницы; карточки разделов оформляются через SectionLayout. */
export const PageLayout: React.FC<PageLayoutProps> = ({
  children, className, ...props
}) => {
  return (
    <div className={cn("flex flex-col my-12 mx-4 sm:mx-21 2xl:mx-42", className)} {...props} >
      { children }
    </div>
  );
}


export interface PageLayoutHeaderProps extends HTMLAttributes<HTMLDivElement> {}

/** Оформляет главный заголовок страницы с декоративным элементом. */
export const PageLayoutHeader: React.FC<PageLayoutHeaderProps> = ({
  className, children, ...props
}) => {

  return (
    <div
      className={cn(
        "w-full inline-flex",
        "text-5xl font-heading font-medium tracking-wide",
        className
      )}
      {...props}
    >
      <h2>
        { children }
      </h2>
      <div className="relative hidden sm:block">
        <div className="absolute left-20 -bottom-1 size-20 rotate-45 bg-gray-300/25"/>
      </div>
    </div>
  );
}


export interface PageLayoutContentProps extends HTMLAttributes<HTMLDivElement> {}

/** Размещает секции страницы вертикально с общими отступами. */
export const PageLayoutContent: React.FC<PageLayoutContentProps> = ({
  className, children, ...props
}) => {
  return (
    <div className={cn("w-full mt-14 flex flex-col gap-6", className)} {...props}>
      { children }
    </div>
  );
}
