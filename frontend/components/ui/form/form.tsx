"use client"
import {FormProvider, useForm, type DefaultValues} from "react-hook-form"
import { z } from 'zod'
import {zodResolver} from "@hookform/resolvers/zod";
import type {ReactNode} from "react";


interface FormProps<TSchema extends z.ZodType<any, any, any>> {
  schema: TSchema,
  onSubmit: (data: z.output<TSchema>) => void | Promise<void>,
  defaultValues: DefaultValues<z.input<TSchema>>,
  className?: string,
  children: ReactNode
}

/** Создаёт контекст react-hook-form: проверяет данные по Zod при отправке и передаёт в onSubmit результат разбора схемой. */
export default function Form<TSchema extends z.ZodType<any, any, any>>({
  schema, onSubmit, defaultValues, className, children
}: FormProps<TSchema>) {
  const methods = useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: defaultValues,
  });

  return (
    <FormProvider {...methods}>
      <form noValidate onSubmit={methods.handleSubmit(onSubmit)} className={className}>{ children }</form>
    </FormProvider>
  )
}
