"use client"

import {Controller, useFormContext, type ControllerProps} from "react-hook-form";
import type {ComponentProps} from "react";
import {Slider} from "@/components/ui/slider";

export interface FormSliderProps extends Omit<
  ComponentProps<typeof Slider>,
  "children" | "value" | "defaultValue" | "onValueChange" | "inputRef"
> {
  name: string;
  range?: boolean;
  rules?: ControllerProps["rules"];
}

export default function FormSlider({
  name, rules, disabled, range = false, min = 0, max = 100, id = name, onBlur, ...props
}: FormSliderProps) {
  const { control } = useFormContext();
  const defaultValue = range ? [min, max] : min;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      disabled={disabled}
      defaultValue={defaultValue}
      render={({ field, fieldState }) => {
        const value = field.value ?? defaultValue;

        return (
          <div className="flex w-full flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Выбрано:</span>
              <output htmlFor={id} className="font-medium tabular-nums">
                {Array.isArray(value) ? value.join(" — ") : value}
              </output>
            </div>
            <Slider
              {...props}
              id={id}
              name={field.name}
              min={min}
              max={max}
              disabled={field.disabled}
              value={value}
              onValueChange={field.onChange}
              inputRef={field.ref}
              aria-invalid={fieldState.invalid}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  field.onBlur();
                }
                onBlur?.(event);
              }}
            />
            <div className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
              <span>Мин.: {min}</span>
              <span>Макс.: {max}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
