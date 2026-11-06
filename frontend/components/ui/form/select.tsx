"use client"

import {Controller, useFormContext, type ControllerProps} from "react-hook-form";
import type {ComponentProps, ReactNode} from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export interface FormSelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface FormSelectGroup {
  label: string;
  items: readonly FormSelectOption[];
}

export interface FormSelectProps extends Omit<
  ComponentProps<typeof Select>,
  "children" | "items" | "value" | "defaultValue" | "onValueChange"
> {
  name: string;
  items: readonly (FormSelectOption | FormSelectGroup)[];
  placeholder?: ReactNode;
  className?: string;
  size?: ComponentProps<typeof SelectTrigger>["size"];
  rules?: ControllerProps["rules"];
}

function renderOption(item: FormSelectOption) {
  return (
    <SelectItem key={`${typeof item.value}:${item.value}`} value={item.value} disabled={item.disabled}>
      {item.label}
    </SelectItem>
  );
}

/** Собирает Select из items (варианты или группы) и связывает выбор с родительским Form. Начальное значение задаётся в defaultValues формы. */
export default function FormSelect({
  name, items, placeholder = "Выберите значение", className, size, rules,
  disabled, multiple, id = name, ...props
}: FormSelectProps) {
  const { control } = useFormContext();
  const options = items.flatMap((item) => "items" in item ? item.items : [item]);

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      disabled={disabled}
      render={({ field, fieldState }) => (
        <Select
          {...props}
          id={id}
          name={field.name}
          items={options}
          multiple={multiple}
          disabled={field.disabled}
          value={field.value ?? (multiple ? [] : null)}
          onValueChange={field.onChange}
        >
          <SelectTrigger
            ref={field.ref}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
            className={className}
            size={size}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item, index) => "items" in item ? (
              <SelectGroup key={`group:${index}`}>
                <SelectLabel>{item.label}</SelectLabel>
                {item.items.map(renderOption)}
              </SelectGroup>
            ) : renderOption(item))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
