import { z } from 'zod'


const agreementField = z.boolean().default(false).refine((v) => v === true, {
  message: "Для начала необходимо согласиться с политикой обработки",
});

const baseContent = z.string().trim()
  .max(3500, "Сообщение не может быть длиннее 3500 символов")
  .default("");

export const companyContactMeSchema = z.object({
  name: z.string().trim()
    .min(2, "ФИО не может быть короче 2 символов")
    .max(255, "ФИО не может быть длиннее 255 символов"),
  company: z.string().trim()
    .min(2, "Название компании не может быть короче 2 символов")
    .max(255, "Название компании не может быть длиннее 255 символов"),
  email: z.string().trim().email("Должен быть валидный email"),
  telegram: z.string().trim()
    .min(2, "Тег Telegram не может быть короче 2 символов")
    .max(255, "Тег Telegram не может быть длиннее 255 символов")
    .startsWith("@", "Тег Telegram должен начинаться с \"@\""),
  content: baseContent,
  agreeHRMails: z.boolean().default(false),
  agreeToSubmit: agreementField,
});

// ── Candidate ────────────────────────────────────────────────────────────────
export const candidateContactMeSchema = z.object({
  name: z.string().trim()
    .min(2, "ФИО не может быть короче 2 символов")
    .max(255, "ФИО не может быть длиннее 255 символов"),
  email: z.string().trim().email("Должен быть валидный email"),
  content: baseContent,
  agreeHRMails: z.boolean().default(false),
  agreeToSubmit: agreementField,
});


export type EmployerContactForm = z.output<typeof companyContactMeSchema>;
export type CandidateContactForm = z.output<typeof candidateContactMeSchema>;