"use client"

import { useFormContext } from "react-hook-form"
import { ComponentProps } from "react"
import { Input } from "@/components/ui/input"
import { useFormFieldId } from "./form-field"

interface FormInputProps extends ComponentProps<typeof Input> {
  name: string
}

/** Регистрирует текстовое поле по name в родительском Form и отображает состояние ошибки. */
export default function FormInput({ name, id, ...props }: FormInputProps) {
  const { register, getFieldState, formState } = useFormContext()
  const { error } = getFieldState(name, formState)
  const controlId = useFormFieldId(name, id)

  return <Input {...props} {...register(name)} id={controlId} aria-invalid={!!error} />
}
