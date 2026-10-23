"use client"

import { SiteHeader } from "@/components/landing/site-header";
import {Button} from "@/components/ui/button";
import Image from "next/image";
import {Lightbulb, CodeXml, Database, FileText, Puzzle, FileChartPie} from "lucide-react";
import {cn} from "cn";
import React from "react";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import Form from "@/components/ui/form/form";
import FormInput from "@/components/ui/form/input";
import FormField from "@/components/ui/form/form-field";
import FormTextarea from "@/components/ui/form/textarea";
import FormCheckbox from "@/components/ui/form/checkbox";
import {companyContactMeSchema} from "@/schemas/company-contact";
import {LandingSection} from "@/components/landing/landing-section";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { sendContactForm } from "@/lib/api/contact";
import FAQ from "@/components/landing/faq";
import ContactMeSection from "@/components/landing/contact-me";

export default function Home() {
  return (
    <div className="w-full overflow-hidden">
      <main className="[&>div:not(:first-child)]:mt-14 [&>div:last-child]:mb-28">
        <CompanyHeroSection />
        <LandingSection subtitle="Варианты поиска" title="Выбирайте удобное">
          <TariffVariants />
        </LandingSection>
        <LandingSection subtitle="Почему мы" title="Как мы помогаем?">
          <HowWeAreHelping />
        </LandingSection>
        <LandingSection subtitle="Глубже в процесс" title="Как всё происходит?">
          <HowDoesItWork />
        </LandingSection>
        <ContactMeSection type="candidate" />
        <LandingSection subtitle="Если что-то не нашли" title="Часто задаваемые вопросы">
          <FAQ type="employer"/>
        </LandingSection>
      </main>
    </div>
  );
}


function CompanyHeroSection() {
  return (
    <div className="relative flex justify-center w-full h-[80dvh]">
      <Image src="/figma/Asterisk 2.svg" alt="asterisk"
             className="absolute w-37 h-auto left-20 top-40 2xl:left-40 2xl:top-50 2xl:scale-125"
             width={0} height={0} />
      <Image src="/figma/Butterfly.svg" alt="asterisk"
             className="absolute w-30 h-auto right-50 top-10 2xl:right-80 2xl:top-20 2xl:scale-125"
             width={0} height={0} />
      <Image src="/figma/Rhode Island.svg" alt="asterisk"
             className="absolute w-37 h-auto right-20 top-60 2xl:right-30 2xl:top-80 2xl:scale-125"
             width={0} height={0} />
      <Image src="/figma/Teewee.svg" alt="asterisk"
             className="absolute w-50 h-auto right-30 bottom-5 2xl:right-70 2xl:bottom-10 2xl:scale-125"
             width={0} height={0} />
      <Image src="/figma/Orange Ricky.svg" alt="asterisk"
             className="absolute w-50 h-auto left-10 bottom-0 2xl:left-50 2xl:bottom-0 2xl:scale-125"
             width={0} height={0} />

      <div className="flex flex-col gap-26 m-auto">
            <span className="w-162 gap-5">
              <h1 className="text-center text-5xl/18 font-heading tracking-widest font-medium">
                ТЕСТОВЫЕ {" "}
                <span className="text-white px-6 py-1 bg-primary rounded-full">БОЛЬШЕ</span>
                <br/>
                НЕ ПРОБЛЕМА
              </h1>
              <h5 className="text-center text-2xl text-black">
                Помогаем компаниям находить молодых и перспективных специалистов ещё легче
              </h5>
            </span>

        <div className="flex gap-6 m-auto">
          <Link href="#contactMeSection">
            <Button variant="default" size="xl">Зарегистрировать компанию</Button>
          </Link>
          <Link href="#contactMeSection">
            <Button variant="outline" size="xl">Связаться с нами</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}


function TariffVariants() {
  return (
    <div
      className="flex justify-around w-4/5 gap-8 2xl:w-[70%] px-12 py-24 border border-gray-200 rounded-4xl bg-[radial-gradient(transparent,#FFFFFF),radial-gradient(#B6A2D450,#FFFFFF20),url('/figma/DotGrid.svg')] bg-center"
    >
      <div className="flex flex-col justify-between bg-white border border-gray-200 shadow-xs px-4 py-3 gap-8 rounded-2xl">
        <div className="flex flex-col gap-4">
          <div className="p-3 w-fit bg-[#4B8F8C]/10 text-[#4B8F8C] rounded-xl">
            <CodeXml className="size-6"/>
          </div>
          <span className="flex flex-col gap-0.5">
                  <h2
                    className="font-heading text-xl font-medium tracking-wide text-black"
                  >
                    Публикация тестовых заданий
                  </h2>
                  <p className="text-black text-sm">
                    Публикуйте задачи, ставьте дедлайны и кандидаты сами свяжутся с вами
                  </p>
                </span>
          <ul className="text-gray-500 text-sm list-disc ms-8 gap-2">
            <li>Платите только за публикацию</li>
            <li>Доступ к кандидатам в течении 30 дней после завершения тестового</li>
          </ul>
        </div>

        <Button variant="default" size="lg" className="w-full">Узнать подробнее</Button>
      </div>
      <div className="flex flex-col justify-between bg-white border border-gray-200 shadow-xs px-4 py-3 gap-8 rounded-2xl">
        <div className="flex flex-col gap-4">
          <div className="p-3 w-fit bg-[#B287A3]/5 text-[#B287A3] rounded-xl">
            <Database className="size-6"/>
          </div>
          <span className="flex flex-col gap-0.5">
            <h2
              className="font-heading text-xl font-medium tracking-wide text-black"
            >
              Доступ к базе соискателей
            </h2>
            <p className="text-black text-sm">
              Позволяет самим находить подходящих кандидатов и связываться с ними
            </p>
          </span>
          <ul className="text-gray-500 text-sm list-disc ms-8 gap-2">
            <li>Платите только за просмотр контактов кандидата</li>
            <li>Различные тарифы на 7/30/90 дней</li>
          </ul>
        </div>

        <Button variant="outline" size="lg" className="w-full">Узнать подробнее</Button>
      </div>
    </div>
  );
}


function HowWeAreHelping() {
  return (
      <div
        className="flex relative flex-col gap-6 w-4/5 xl:w-3/5 2xl:w-1/2 px-12 py-12 border border-gray-200 rounded-4xl bg-[linear-gradient(to_right,#cccccc4D_1px,transparent_1px),linear-gradient(to_bottom,#cccccc4D_1px,transparent_1px)]
                  bg-[size:var(--cell)_var(--cell)]"
      >
        <div className="pointer-events-none absolute inset-0 rounded-4xl
                        bg-[linear-gradient(to_left,#FFFFFF0D,#B6A2D44D)]"></div>
      <div className="flex w-full z-10 bg-white border border-gray-200 shadow-xs px-4 py-3 gap-6 rounded-2xl">
        <div className="p-3 w-fit bg-[#260686]/10 text-[#260686] rounded-xl">
          <FileText className="size-12" strokeWidth="1" />
        </div>
        <span className="flex flex-col justify-center gap-0.5">
                <h2
                  className="font-heading text-xl font-medium tracking-wide text-black"
                >
                  Единые метрики оценивания
                </h2>
                <p className="text-black text-sm">
                  Помогаем оценивать тестовое в едином, удобном для вас, формате
                </p>
              </span>
      </div>
      <div className="flex w-full z-10 bg-white border border-gray-200 shadow-xs px-4 py-3 gap-6 rounded-2xl">
        <div className="p-3 w-fit bg-[#B287A3]/10 text-[#B287A3] rounded-xl">
          <Lightbulb className="size-12" strokeWidth="1" />
        </div>
        <span className="flex flex-col justify-center gap-0.5">
                <h2
                  className="font-heading text-xl font-medium tracking-wide text-black"
                >
                  Помогаем с идеей тестового
                </h2>
                <p className="text-black text-sm">
                  Наша поддержка всегда с вами от продумывания идея задачи до её публикации
                </p>
              </span>
      </div>
      <div className="flex w-full z-10 bg-white border border-gray-200 shadow-xs px-4 py-3 gap-6 rounded-2xl">
        <div className="p-3 w-fit bg-[#4B8F8C]/10 text-[#4B8F8C] rounded-xl">
          <Puzzle className="size-12" strokeWidth="1" />
        </div>
        <span className="flex flex-col justify-center gap-0.5">
                <h2
                  className="font-heading text-xl font-medium tracking-wide text-black"
                >
                  Портфолио всегда под рукой
                </h2>
                <p className="text-black text-sm">
                  Если результата реализации тестового недостаточно для оценки кандидата
                </p>
              </span>
      </div>
      <div className="flex w-full z-10 bg-white border border-gray-200 shadow-xs px-4 py-3 gap-6 rounded-2xl">
        <div className="p-3 w-fit bg-[#FF715B]/10 text-[#FF715B] rounded-xl">
          <FileChartPie className="size-12" strokeWidth="1" />
        </div>
        <span className="flex flex-col justify-center gap-0.5">
                <h2
                  className="font-heading text-xl font-medium tracking-wide text-black"
                >
                  Подробное портфолио кандидатов
                </h2>
                <p className="text-black text-sm">
                  Не просто суть и стек, а процесс создания, проблема и итоговая реализация
                </p>
              </span>
      </div>
    </div>
  );
}


interface StepProps {
  index: number
  title: string
  subtitle: string
  className?: string
}


function Step({index, title, subtitle, className}: StepProps) {
  const margins = ["ml-0", "ml-10 xl:ml-30", "ml-20 xl:ml-60", "ml-30 xl:ml-90"]
  return (
    <span className={cn(
      "w-175 grid gap-0.5 bg-white border border-gray-200 px-4 py-3 rounded-lg shadow-xs",
      margins[index-1],
      className,
    )}>
      <h2 className="font-heading text-4xl font-bold tracking-widest text-primary">
        { index }.
      </h2>
      <h5 className="font-heading text-2xl font-medium tracking-wide text-black">
        { title }
      </h5>
      <p className="text-black">
        { subtitle }
      </p>
    </span>
  );
}


function HowDoesItWork() {
  return (
    <>
      <Image src="/figma/Asterisk 2.svg" alt="asterisk"
             className="absolute z-0 w-37 h-auto right-20 top-40 2xl:right-60 2xl:top-30 2xl:scale-125"
             width={0} height={0} />
      <Image src="/figma/Teewee.svg" alt="asterisk"
             className="absolute z-0 hidden xl:block w-50 h-auto right-30 bottom-50 -rotate-10 2xl:right-40 2xl:bottom-30 2xl:scale-125"
             width={0} height={0} />
      <Image src="/figma/Orange Ricky.svg" alt="asterisk"
             className="absolute z-0 hidden xl:block w-50 h-auto right-90 top-50 2xl:right-150 2xl:top-45 2xl:scale-125 -rotate-150"
             width={0} height={0} />
      <Image src="/figma/Rhode Island.svg" alt="asterisk"
             className="absolute z-0 w-37 h-auto left-10 xl:left-30 bottom-10 -rotate-20 2xl:left-70 2xl:bottom-10 2xl:scale-125"
             width={0} height={0} />
      <div className="w-4/5 z-1 2xl:w-[70%] flex flex-col gap-8">
        <Step index={1} title="Зарегистрируйтесь"
              subtitle="Чтобы получить доступ к нашему сервису" />
        <Step index={2} title="Опубликуйте тестовое"
              subtitle="Укажите дедлайн и получайте решения сами, без необходимости поиска кандидатов вручную" />
        <Step index={3} title="Оцените решения"
              subtitle="После отправки работы кандидатами оцените их решения быстро благодаря четким критериям проверки" />
        <Step index={4} title="Выбирайте лучших" className="w-200"
              subtitle="После оценки просматривайте всех в итоговой таблице с едиными метриками и получите самых перспективных специалистов к себе в компанию" />
      </div>
    </>
  );
}


// function ContactMeSection() {
//   const { mutate, isPending } = useMutation({
//     mutationFn: sendContactForm,
//     onSuccess: () => {
//       toast.success("Заявка отправлена! Мы свяжемся с вами.");
//     },
//     onError: (e: Error) => {
//       toast.error(e.message || "Не удалось отправить форму");
//     },
//   });



//   return (
//     <div
//       id="contactMeSection"
//       className={cn(
//         "w-4/5 xl:w-3/5 m-auto flex flex-col gap-12",
//         " border border-gray-200 bg-radial from-primary-pink/15 to-white",
//         "shadow-xs px-32 py-8 rounded-2xl",
//       )}
//     >
//       <span className="grid text-center gap-0.5">
//         <h2 className="font-heading text-5xl font-medium tracking-wide text-primary">
//           Заполните форму
//         </h2>
//         <h5 className="text-2xl text-black">и мы обязательно свяжемся!</h5>
//       </span>
//       <Form
//         schema={companyContactMeSchema}
//         defaultValues={{
//           name: "",
//           company: "",
//           email: "",
//           content: undefined,
//           telegram: "",
//           agreeHRMails: false,
//           agreeToSubmit: false,
//         }}
//         onSubmit={(data) => mutate(data)}
//         className="grid grid-cols-2 gap-x-5 gap-y-4"
//       >
//         <FormField name="name" label="Как к вам обращаться">
//           <FormInput name="name" placeholder="ФИО" />
//         </FormField>
//         <FormField name="company" label="Компания">
//           <FormInput name="company" placeholder="Ваша компания" />
//         </FormField>
//         <FormField name="email" label="Электронная почта">
//           <FormInput name="email" placeholder="example@example.com" />
//         </FormField>
//         <FormField name="content" label="Сообщение или предложение" className="row-span-2">
//           <FormTextarea name="content" placeholder="Идеи, концепты или любая информация" className="h-full" />
//         </FormField>
//         <FormField name="telegram" label="Телеграм">
//           <FormInput name="telegram" placeholder="@username" />
//         </FormField>

//         <FormField
//           name="agreeHRMails" orientation="horizontal" className="col-span-2 *:font-normal"
//           label="Я хочу получать HR-рассылку"
//         >
//           <FormCheckbox name="agreeHRMails" />
//         </FormField>
//         <FormField
//           name="agreeToSubmit" orientation="horizontal" className="col-span-2 *:font-normal"
//           label="Нажимая кнопку «Отправить», я соглашаюсь с политикой обработки персональных данных"
//         >
//           <FormCheckbox name="agreeToSubmit" />
//         </FormField>

//         <Button type="submit" size="lg" disabled={isPending} className="w-fit col-span-2 m-auto mt-6">
//         {isPending ? "Отправка..." : "Отправить"}
//       </Button>
//       </Form>
//     </div>
//   );
// }


function CompanyFAQ() {
  const faqs: { id: string, ask: string, answer: string }[] = [
    {
      id: "haveToRegister",
      ask: "Обязательно ли мне регистрироваться, чтобы найти идеи для портфолио?",
      answer: "Нет, не обязательно.",
    },
    {
      id: "difference",
      ask: "Чем мы отличаемся?",
      answer: "Всем",
    },
    {
      id: "canIPublic",
      ask: "Могу ли я опубликовать свою задачу?",
      answer: "Да",
    },
    {
      id: "canDelete",
      ask: "Как я могу удалить свои данные с вашего сервиса?",
      answer: "Потом скажем",
    },
  ]
  return (
    <Accordion className="w-3/4">
      {
        faqs.map((question) => (
          <AccordionItem value={question.id} key={question.id}>
            <AccordionTrigger className="font-heading text-lg">{ question.ask }</AccordionTrigger>
            <AccordionContent>{ question.answer }</AccordionContent>
          </AccordionItem>
        ))
      }
    </Accordion>
  );
}
