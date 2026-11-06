import React, {HTMLAttributes} from "react";
import {cn} from "cn";


/** Визуальная карточка раздела страницы; не создаёт форму и не управляет данными. */
export const SectionLayout: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children, className, ...props
}) => {

  return (
    <div className={cn("w-full bg-white px-6 py-4 xl:px-9 xl:py-6 rounded-2xl shadow-sm border", className)} {...props}>
      { children }
    </div>
  );
}

/** Общая строка для SectionLayoutHeader и SectionLayoutActions; допускает перенос на узком экране. */
export const SectionLayoutHeaderRow: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children, className, ...props
}) => (
  <div className={cn("flex w-full flex-wrap items-center gap-x-4 gap-y-3", className)} {...props}>
    {children}
  </div>
);

/** Контейнер кнопок справа в SectionLayoutHeaderRow; обработчики действий передаёт вызывающий компонент. */
export const SectionLayoutActions: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children, className, ...props
}) => (
  <div className={cn("ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2", className)} {...props}>
    {children}
  </div>
);

export const SectionLayoutHeader: React.FC<HTMLAttributes<HTMLHeadingElement>> = ({
  children, className, ...props
}) => {

  return (
    <h2 className={cn("text-4xl font-heading font-medium tracking-wider", className)} {...props}>
      { children }
    </h2>
  );
}


export const SectionLayoutDescription: React.FC<HTMLAttributes<HTMLParagraphElement>> = ({
  children, className, ...props
}) => {

  return (
    <p className={cn("text-muted-foreground text-base font-normal mt-1", className)} {...props}>
      { children }
    </p>
  );
}


/** Контент секции с единым отступом от её заголовка и описания. */
export const SectionLayoutContent: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children, className, ...props
}) => {

  return (
    <div className={cn("w-full mt-5 flex flex-col", className)} {...props}>
      { children }
    </div>
  );
}
