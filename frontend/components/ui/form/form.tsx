"use client"
import { FormProvider, useForm, type DefaultValues, type FieldValues } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, type ReactNode } from "react"

interface FormProps<TInput extends FieldValues, TOutput extends FieldValues> {
  schema: z.ZodType<TOutput, TInput>
  onSubmit: (data: TOutput) => void | Promise<void>
  defaultValues: DefaultValues<TInput>
  /** Подписка на непроверенный ввод для автосохранения; onSubmit получает уже результат Zod. */
  onValuesChange?: (values: TInput) => void
  onInvalid?: () => void
  id?: string
  /** Общий контекст для разных секций: HTML-form выводится отдельно, чтобы не вкладывать формы пунктов друг в друга. */
  detached?: boolean
  className?: string
  children: ReactNode
}

/** Создаёт контекст react-hook-form: проверяет данные по Zod при отправке и передаёт в onSubmit результат разбора схемой. */
export default function Form<TInput extends FieldValues, TOutput extends FieldValues>({
  schema,
  onSubmit,
  defaultValues,
  onValuesChange,
  onInvalid,
  id,
  detached = false,
  className,
  children,
}: FormProps<TInput, TOutput>) {
  const methods = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: defaultValues,
  })
  const { subscribe } = methods
  useEffect(() => {
    if (!onValuesChange) return
    return subscribe({
      formState: { values: true },
      callback: ({ values }) => onValuesChange(values),
    })
  }, [subscribe, onValuesChange])

  return (
    <FormProvider {...methods}>
      <form
        id={id}
        noValidate
        onSubmit={methods.handleSubmit(onSubmit, onInvalid)}
        className={className}
      >
        {!detached && children}
      </form>
      {detached && children}
    </FormProvider>
  )
}
