"use client"

import { Controller, useFormContext } from "react-hook-form"
import { ComponentProps } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { useFormFieldId } from "./form-field"

interface FormCheckboxProps extends ComponentProps<typeof Checkbox> {
  name: string
}

/** Связывает чекбокс с boolean-полем родительского Form, включая изменение, потерю фокуса и фокус при ошибке. */
export default function FormCheckbox({ name, id, disabled, onBlur, ...props }: FormCheckboxProps) {
  const { control } = useFormContext()
  const controlId = useFormFieldId(name, id)

  return (
    <Controller
      control={control}
      disabled={disabled}
      render={({ field, fieldState }) => (
        <Checkbox
          {...props}
          id={controlId}
          name={field.name}
          ref={field.ref}
          disabled={field.disabled}
          aria-invalid={fieldState.invalid}
          checked={field.value ?? false}
          onCheckedChange={field.onChange}
          onBlur={(event) => {
            field.onBlur()
            onBlur?.(event)
          }}
        />
      )}
      name={name}
    />
  )
}
