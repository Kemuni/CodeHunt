"use client";

import Image from "next/image";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "cn";
import type { z } from "zod";

import Form from "@/components/ui/form/form";
import FormInput from "@/components/ui/form/input";
import FormField from "@/components/ui/form/form-field";
import FormTextarea from "@/components/ui/form/textarea";
import FormCheckbox from "@/components/ui/form/checkbox";
import { Button } from "@/components/ui/button";

import { UserType } from "@/lib/types";
import { 
  companyContactMeSchema, 
  candidateContactMeSchema 
} from "@/schemas/contact-schemas"; 
import { 
  sendEmployerContactForm, 
  sendCandidateContactForm 
} from "@/lib/api/contact";

type EmployerFormOutput = z.output<typeof companyContactMeSchema>;
type CandidateFormOutput = z.output<typeof candidateContactMeSchema>;

export default function ContactMeSection({ type }: { type: UserType }) {
  const mutation = useMutation({
    mutationFn: (payload: { type: UserType; data: EmployerFormOutput | CandidateFormOutput }) => {
      if (payload.type === "employer") {
        return sendEmployerContactForm(payload.data as EmployerFormOutput);
      }
      return sendCandidateContactForm(payload.data as CandidateFormOutput);
    },
    onSuccess: () => {
      toast.success("Заявка успешно отправлена! Мы свяжемся с вами.");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Не удалось отправить форму");
    },
  });

  const isEmployer = type === "employer";

  return (
    <div
      id="contactMeSection"
      className={cn(
        "w-4/5 xl:w-3/5 m-auto flex flex-col gap-12",
        "border border-gray-200 bg-radial from-primary-pink/15 to-white",
        "shadow-xs px-32 py-8 rounded-2xl relative isolate overflow-hidden",
      )}
    >
      <div className="pointer-events-none absolute left-[4%] top-1/2 z-0 w-full opacity-50">
        <Image
          className="absolute left-0 top-0 hidden w-33 h-auto -translate-x-1/2 -translate-y-1/2 md:block 2xl:w-37"
          src="/figma/company-marquee/Asterisk 3.svg"
          alt=""
          width={0}
          height={0}
          aria-hidden="true"
        />
        <Image
          className="absolute left-0 top-0 hidden w-54 h-auto -translate-x-1/2 -translate-y-1/2 lg:block 2xl:w-[245px]"
          src="/figma/footer/footer-asterisk-large.svg"
          alt=""
          width={0}
          height={0}
          aria-hidden="true"
        />
      </div>

      <div className="pointer-events-none absolute left-[90%] -top-2 z-0 w-full opacity-50">
        <Image
          className="absolute left-0 top-0 hidden w-33 h-auto -translate-x-1/2 -translate-y-1/2 md:block 2xl:w-37"
          src="/figma/company-marquee/Teewee CM.svg"
          alt=""
          width={0}
          height={0}
          aria-hidden="true"
        />
        <Image
          className="absolute left-0 top-0 hidden w-54 h-auto -translate-x-1/2 -translate-y-1/2 lg:block 2xl:w-58"
          src="/figma/company-marquee/Teewee CM.svg"
          alt=""
          width={0}
          height={0}
          aria-hidden="true"
        />
      </div>

      <span className="grid text-center gap-0.5 z-10">
        <h2 className="font-heading text-5xl font-medium tracking-wide text-primary">
          Заполните форму
        </h2>
        <h5 className="text-2xl text-black">
          и мы обязательно свяжемся!
        </h5>
      </span>

      <div className="z-20">
        {isEmployer ? (
          <EmployerFields
            isPending={mutation.isPending}
            onSubmit={(data) => mutation.mutate({ type: "employer", data })}
          />
        ) : (
          <CandidateFields
            isPending={mutation.isPending}
            onSubmit={(data) => mutation.mutate({ type: "candidate", data })}
          />
        )}
      </div>
    </div>
  );
}

function EmployerFields({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: EmployerFormOutput) => void;
  isPending: boolean;
}) {
  return (
    <Form
      schema={companyContactMeSchema}
      defaultValues={{
        name: "",
        company: "",
        email: "",
        content: "",
        telegram: "",
        agreeHRMails: false,
        agreeToSubmit: false,
      }}
      onSubmit={onSubmit}
      className="grid grid-cols-2 gap-x-5 gap-y-4"
    >
      <FormField name="name" label="Как к вам обращаться">
        <FormInput name="name" placeholder="ФИО" />
      </FormField>
      <FormField name="company" label="Компания">
        <FormInput name="company" placeholder="Ваша компания" />
      </FormField>
      <FormField name="email" label="Электронная почта">
        <FormInput name="email" placeholder="example@example.com" />
      </FormField>
      <FormField name="content" label="Сообщение или предложение" className="row-span-2">
        <FormTextarea
          name="content"
          placeholder="Идеи, концепты или любая информация"
          className="h-full"
        />
      </FormField>
      <FormField name="telegram" label="Телеграм">
        <FormInput name="telegram" placeholder="@username" />
      </FormField>

      <FormField
        name="agreeHRMails"
        orientation="horizontal"
        className="col-span-2 *:font-normal"
        label="Я хочу получать HR-рассылку"
      >
        <FormCheckbox name="agreeHRMails" />
      </FormField>
      <FormField
        name="agreeToSubmit"
        orientation="horizontal"
        className="col-span-2 *:font-normal"
        label="Нажимая кнопку «Отправить», я соглашаюсь с политикой обработки персональных данных"
      >
        <FormCheckbox name="agreeToSubmit" />
      </FormField>

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="w-fit col-span-2 m-auto mt-6"
      >
        {isPending ? "Отправка..." : "Отправить"}
      </Button>
    </Form>
  );
}

function CandidateFields({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: CandidateFormOutput) => void;
  isPending: boolean;
}) {
  return (
    <Form
      schema={candidateContactMeSchema}
      defaultValues={{
        name: "",
        email: "",
        content: "",
        agreeHRMails: false,
        agreeToSubmit: false,
      }}
      onSubmit={onSubmit}
      className="grid gap-x-5 gap-y-4"
    >
      <div className="grid grid-flow-col grid-rows-2 grid-cols-2 gap-x-5 gap-y-4 col-span-2">
        <FormField name="name" label="Как к вам обращаться">
          <FormInput name="name" placeholder="ФИО" />
        </FormField>
        <FormField name="email" label="Электронная почта">
          <FormInput name="email" placeholder="example@example.com" />
        </FormField>
        <FormField 
          name="content" 
          label="Сообщение или предложение" 
          className="row-span-2 flex flex-col"
        >
          <FormTextarea
            name="content"
            placeholder="Идеи, концепты или любая информация"
            className="flex-1 min-h-[120px] resize-none"
          />
        </FormField>
      </div> 
      
      <FormField
        name="agreeHRMails"
        orientation="horizontal"
        className="col-span-2 *:font-normal"
        label="Я согласен получать рассылки информационного и рекламного характера"
      >
        <FormCheckbox name="agreeHRMails" />
      </FormField>
      <FormField
        name="agreeToSubmit"
        orientation="horizontal"
        className="col-span-2 *:font-normal"
        label="Нажимая кнопку «Отправить», я соглашаюсь с политикой обработки персональных данных"
      >
        <FormCheckbox name="agreeToSubmit" />
      </FormField>

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="w-fit col-span-2 m-auto mt-6"
      >
        {isPending ? "Отправка..." : "Отправить"}
      </Button>
    </Form>
  );
}