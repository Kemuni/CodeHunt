import type { z } from "zod"
import type { companyContactMeSchema, candidateContactMeSchema } from "@/schemas/contact-schemas"

import {
  createByCandidateApiContactRequestCandidatePost,
  createByEmployerApiContactRequestEmployerPost,
} from "./generated/sdk.gen"
import type { CandidateContactRequestIn, EmployerContactRequestIn } from "./generated/types.gen"
import { apiData } from "./request"

type EmployerContactForm = z.output<typeof companyContactMeSchema>

export function sendEmployerContactForm(data: EmployerContactForm) {
  const payload: EmployerContactRequestIn = {
    name: data.name,
    email: data.email,
    content: data.content || null,
    is_agree_with_mails: data.agreeHRMails,
    telegram: data.telegram,
    company: data.company,
  }
  return apiData(createByEmployerApiContactRequestEmployerPost({ body: payload }))
}

type CandidateContactForm = z.output<typeof candidateContactMeSchema>

export function sendCandidateContactForm(data: CandidateContactForm) {
  const payload: CandidateContactRequestIn = {
    name: data.name,
    email: data.email,
    content: data.content || null,
    is_agree_with_mails: data.agreeHRMails,
  }
  return apiData(createByCandidateApiContactRequestCandidatePost({ body: payload }))
}
