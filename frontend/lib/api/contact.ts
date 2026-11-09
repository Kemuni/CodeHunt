import type { z } from "zod"
import type { companyContactMeSchema, candidateContactMeSchema } from "@/schemas/contact-schemas"

import { apiRequest } from "./request"

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
  return apiRequest("contact-request/employer", { method: "POST", body: payload })
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
  return apiRequest("contact-request/candidate", { method: "POST", body: payload })
}
