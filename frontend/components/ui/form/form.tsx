"use client"
import { FormProvider, useForm, type DefaultValues, type FieldValues } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ReactNode } from "react"

interface FormProps<TInput extends FieldValues, TOutput extends FieldValues> {
  schema: z.ZodType<TOutput, TInput>
  onSubmit: (data: TOutput) => void | Promise<void>
  defaultValues: DefaultValues<TInput>
  id?: string
  className?: string
  children: ReactNode
}

/** Создаёт контекст react-hook-form: проверяет данные по Zod при отправке и передаёт в onSubmit результат разбора схемой. */
export default function Form<TInput extends FieldValues, TOutput extends FieldValues>({
  schema,
  onSubmit,
  defaultValues,
  id,
  className,
  children,
}: FormProps<TInput, TOutput>) {
  const methods = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: defaultValues,
  })

  return (
    <FormProvider {...methods}>
      <form id={id} noValidate onSubmit={methods.handleSubmit(onSubmit)} className={className}>
        {children}
      </form>
    </FormProvider>
  )
}
