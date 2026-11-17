import assert from "node:assert/strict"
import { test } from "node:test"
import { sendCandidateContactForm, sendEmployerContactForm } from "../api/contact"
import { ApiError } from "../api/request"
import { client } from "../api/generated/client.gen"

test("both contact forms use the shared same-origin transport and error contract", async (context) => {
  const previousBaseUrl = client.getConfig().baseUrl
  client.setConfig({ baseUrl: "http://localhost/api/backend" })
  context.after(() => client.setConfig({ baseUrl: previousBaseUrl }))
  const requests: { url: string; body: Record<string, unknown> }[] = []
  context.mock.method(globalThis, "fetch", async (request: Request) => {
    requests.push({ url: request.url, body: await request.json() })
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
    [
      "http://localhost/api/backend/contact-request/candidate",
      "http://localhost/api/backend/contact-request/employer",
    ],
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
