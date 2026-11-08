import type { z } from "zod"
import type { companyContactMeSchema, candidateContactMeSchema } from "@/schemas/contact-schemas"

import { routes } from "@/lib/config";


interface ErrorResponse {
  success: false
  data: null
  errors: {
    code: string
    message: string
  }
}
type SuccessResponse<T = unknown> = {
  success: true
  data: T
  errors: null
}

async function postContactRequest<TBody>(path: string, body: TBody) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const json = (await res.json().catch(() => null)) as SuccessResponse | ErrorResponse | null

  if (!res.ok || !json || !json.success) {
    const message = (json && "errors" in json && json.errors?.message) || `Ошибка ${res.status}`
    throw new Error(message)
  }
  return json.data
}

type EmployerContactForm = z.output<typeof companyContactMeSchema>

// Тело запроса под EmployerContactRequestIn
interface EmployerContactRequestIn {
  name: string
  email: string
  content?: string | null
  is_agree_with_mails?: boolean
  telegram: string
  company: string
}

export function sendEmployerContactForm(data: EmployerContactForm) {
  const payload: EmployerContactRequestIn = {
    name: data.name,
    email: data.email,
    content: data.content || null,
    is_agree_with_mails: data.agreeHRMails,
    telegram: data.telegram,
    company: data.company,
  }
  return postContactRequest(routes.employers, payload)
}

type CandidateContactForm = z.output<typeof candidateContactMeSchema>

interface CandidateContactRequestIn {
  name: string
  email: string
  content?: string | null
  is_agree_with_mails?: boolean
}

export function sendCandidateContactForm(data: CandidateContactForm) {
  const payload: CandidateContactRequestIn = {
    name: data.name,
    email: data.email,
    content: data.content || null,
    is_agree_with_mails: data.agreeHRMails,
  }
  return postContactRequest(routes.candidates, payload)
}
