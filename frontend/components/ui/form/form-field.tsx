"use client"

import {useFormContext} from "react-hook-form";
import {createContext, useContext, type ComponentProps, type ReactNode} from "react";
import {Field, FieldError, FieldLabel} from "@/components/ui/field";


interface FormFieldProps extends ComponentProps<typeof Field> {
  label: ReactNode
  name: string
  controlId?: string
  labelClassName?: string
}

const FormFieldIdContext = createContext<string | undefined>(undefined);

export function useFormFieldId(name: string, id?: string) {
  const controlId = useContext(FormFieldIdContext);
  return id ?? controlId ?? name;
}

export default function FormField({
  name, label, children, controlId = name, labelClassName, ...props
}: FormFieldProps) {
  const { getFieldState, formState } = useFormContext()
  const { error } = getFieldState(name, formState)

  return (
    <FormFieldIdContext.Provider value={controlId}>
      <Field data-invalid={!!error} {...props}>
        { props.orientation === "horizontal" && (children) }
        <FieldLabel htmlFor={controlId} className={labelClassName}>{ label }</FieldLabel>
        { props.orientation !== "horizontal" && (children) }
        {error && <FieldError id={`${controlId}-error`} errors={[error]}/>}
      </Field>
    </FormFieldIdContext.Provider>
  );
}
