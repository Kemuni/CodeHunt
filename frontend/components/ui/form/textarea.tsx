"use client"

import {useFormContext} from "react-hook-form";
import {ComponentProps} from "react";
import {Textarea} from "@/components/ui/textarea";
import {useFormFieldId} from "./form-field";


interface FormTextareaProps extends ComponentProps<typeof Textarea> {
  name: string
}


/** Регистрирует многострочное поле в родительском Form; подпись и сообщение об ошибке задаются через FormField. */
export default function FormTextarea({
  name, id, ...props
}: FormTextareaProps) {
  const { register, getFieldState, formState } = useFormContext()
  const { error } = getFieldState(name, formState)
  const controlId = useFormFieldId(name, id)

  return (
    <Textarea
      {...props}
      {...register(name)}
      id={controlId}
      aria-invalid={!!error}
    />
  );
}
