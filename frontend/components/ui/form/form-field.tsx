"use client"

import {useFormContext} from "react-hook-form";
import {ComponentProps, ReactNode} from "react";
import {Field, FieldError, FieldLabel} from "@/components/ui/field";


interface FormFieldProps extends ComponentProps<typeof Field> {
  label: ReactNode
  name: string
}


export default function FormField({
  name, label, children, ...props
}: FormFieldProps) {
  const { formState: { errors } } = useFormContext()
  const error = errors?.[name]

  return (
    <Field data-invalid={!!error} {...props}>
      { props.orientation === "horizontal" && (children) }
      <FieldLabel htmlFor={name}>{ label }</FieldLabel>
      { props.orientation !== "horizontal" && (children) }
      {error && <FieldError errors={[error]}/>}
    </Field>
  );
}
