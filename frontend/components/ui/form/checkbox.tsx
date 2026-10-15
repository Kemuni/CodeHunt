"use client"

import {Controller, useFormContext} from "react-hook-form";
import {ComponentProps} from "react";
import {Checkbox} from "@/components/ui/checkbox";


interface FormCheckboxProps extends ComponentProps<typeof Checkbox> {
  name: string
}


export default function FormCheckbox({
  name, ...props
}: FormCheckboxProps) {
  const { control, formState: { errors } } = useFormContext()
  const error = errors?.[name]

    // <Checkbox id={name} aria-invalid={!!error} {...props} {...register(name)}/>
  return (
    <Controller
      control={control}
      render={
        ({ field }) => (
          <Checkbox id={name} aria-invalid={!!error} {...props}
                    checked={field.value} onCheckedChange={field.onChange} />
        )
      }
      name={name}
    />
  );
}
