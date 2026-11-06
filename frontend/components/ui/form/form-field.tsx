"use client"

import {useFormContext} from "react-hook-form";
import {createContext, useContext, type ComponentProps, type ReactNode} from "react";
import {Field, FieldError, FieldLabel} from "@/components/ui/field";


interface FormFieldProps extends ComponentProps<typeof Field> {
  label: ReactNode
  name: string
  /** Уникальный HTML-id поля, если name повторяется в разных формах; имя в данных формы не меняется. */
  controlId?: string
  labelClassName?: string
}

/** Передаёт controlId вложенному полю, чтобы его id совпал с htmlFor подписи без повторной передачи пропса. */
const FormFieldIdContext = createContext<string | undefined>(undefined);

/** Выбирает HTML-id: явный id, затем controlId из контекста FormField, иначе name. */
export function useFormFieldId(name: string, id?: string) {
  const controlId = useContext(FormFieldIdContext);
  return id ?? controlId ?? name;
}

/** Связывает подпись и ошибку с полем родительской формы. Регистрацией значения занимается вложенный FormInput, FormCheckbox и т. п. */
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
