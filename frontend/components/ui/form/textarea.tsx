"use client"

import {useFormContext} from "react-hook-form";
import {ComponentProps} from "react";
import {Textarea} from "@/components/ui/textarea";
import {useFormFieldId} from "./form-field";


interface FormTextareaProps extends ComponentProps<typeof Textarea> {
  name: string
}


export default function FormTextarea({
  name, id, "aria-describedby": describedBy, ...props
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
      aria-describedby={[describedBy, error && `${controlId}-error`].filter(Boolean).join(" ") || undefined}
    />
  );
}
