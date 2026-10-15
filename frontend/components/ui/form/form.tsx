"use client"
import {FormProvider, useForm} from "react-hook-form"
import { z } from 'zod'
import {zodResolver} from "@hookform/resolvers/zod";
import type {ReactNode} from "react";


interface FormProps<TSchema extends z.ZodType<any, any, any>> {
  schema: TSchema,
  onSubmit: (data: z.output<TSchema>) => void | Promise<void>,
  defaultValues?: z.input<TSchema>,
  className?: string,
  children: ReactNode
}

export default function Form<TSchema extends z.ZodType<any, any, any>>({
  schema, onSubmit, defaultValues, className, children
}: FormProps<TSchema>) {
  const methods = useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: defaultValues,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className={className}>{ children }</form>
    </FormProvider>
  )
}
