"use client"

import {useFormContext} from "react-hook-form";
import {ComponentProps} from "react";
import {Input} from "@/components/ui/input";
import {useFormFieldId} from "./form-field";


interface FormInputProps extends ComponentProps<typeof Input> {
  name: string
}


export default function FormInput({
  name, id, "aria-describedby": describedBy, ...props
}: FormInputProps) {
  const { register, getFieldState, formState } = useFormContext()
  const { error } = getFieldState(name, formState)
  const controlId = useFormFieldId(name, id)

  return (
    <Input
      {...props}
      {...register(name)}
      id={controlId}
      aria-invalid={!!error}
      aria-describedby={[describedBy, error && `${controlId}-error`].filter(Boolean).join(" ") || undefined}
    />
  );
}
