"use client"

import {useFormContext} from "react-hook-form";
import {ComponentProps} from "react";
import {Input} from "@/components/ui/input";


interface FormInputProps extends ComponentProps<typeof Input> {
  name: string
}


export default function FormInput({
  name, ...props
}: FormInputProps) {
  const { register, formState: { errors } } = useFormContext()
  const error = errors?.[name]

  return (
    <Input id={name} aria-invalid={!!error} {...props} {...register(name)}/>
  );
}
