"use client"

import {useFormContext} from "react-hook-form";
import {ComponentProps} from "react";
import {Textarea} from "@/components/ui/textarea";


interface FormTextareaProps extends ComponentProps<typeof Textarea> {
  name: string
}


export default function FormTextarea({
  name, ...props
}: FormTextareaProps) {
  const { register, formState: { errors } } = useFormContext()
  const error = errors?.[name]

  return (
    <Textarea id={name} aria-invalid={!!error} {...props} {...register(name)}/>
  );
}
