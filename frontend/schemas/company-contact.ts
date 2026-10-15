import { z } from 'zod'


export const companyContactMeSchema = z.object({
  name: z.string().trim()
    .nonempty("Поле не может быть пустым")
    .min(2, "ФИО не может быть короче 2 символов")
    .max(150, "ФИО не может быть длиннее 150 символов"),
  company: z.string().trim()
    .nonempty("Поле не может быть пустым")
    .min(2, "Название компании не может быть короче 2 символов")
    .max(150, "Название компании не может быть длиннее 150 символов"),
  email: z.email("Должен быть валидный email").trim(),
  telegram: z.string().trim()
    .nonempty("Поле не может быть пустым")
    .min(2, "Тег Telegram не может быть короче 2 символов")
    .max(150, "Тег Telegram не может быть длиннее 150 символов")
    .startsWith("@", "Тег Telegram должен начинаться с \"@\""),
  content: z.string().trim()
    .max(3000, "Сообщение не может быть длиннее 3000 символов")
    .default(''),
  agreeToSubmit: z.boolean().default(false)
    .refine(
      (v) => v === true,
      { message: "Для начала необходимо согласиться с политикой обработки" },
    ),
  agreeHRMails: z.boolean().default(false),
});
