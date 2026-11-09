import assert from "node:assert/strict"
import { test } from "node:test"
import { sendCandidateContactForm, sendEmployerContactForm } from "../api/contact"
import { ApiError } from "../api/request"

test("both contact forms use the shared same-origin transport and error contract", async (context) => {
  const requests: { url: string; body: Record<string, unknown> }[] = []
  context.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(init.body as string) })
    return Response.json({ success: true, data: { accepted: true } })
  })
  const form = {
    name: "Test",
    email: "test@example.com",
    content: "",
    agreeHRMails: true,
    agreeToSubmit: true,
  }
  await sendCandidateContactForm(form)
  await sendEmployerContactForm({ ...form, company: "Company", telegram: "@test" })
  assert.deepEqual(
    requests.map((request) => request.url),
    ["/api/backend/contact-request/candidate", "/api/backend/contact-request/employer"],
  )
  assert.equal(requests[0].body.content, null)
  assert.equal(requests[0].body.is_agree_with_mails, true)
  context.mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        success: false,
        errors: { code: "invalid_contact", message: "Проверьте контакт" },
      },
      { status: 422 },
    ),
  )
  await assert.rejects(
    sendCandidateContactForm(form),
    (error: unknown) =>
      error instanceof ApiError && error.status === 422 && error.message === "Проверьте контакт",
  )
})
