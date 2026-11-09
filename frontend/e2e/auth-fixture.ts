import { test as base, expect } from "@playwright/test"
import { encode } from "next-auth/jwt"

export async function sessionCookie(role: "admin" | "member" | "expired" = "admin") {
  const secret = process.env.E2E_AUTH_SECRET
  if (!secret) throw new Error("Для изолированных E2E задайте E2E_AUTH_SECRET")
  return {
    name: "next-auth.session-token",
    value: await encode({
      secret,
      token: {
        name: "GitHub Test User",
        picture: "/figma/our-logo.svg",
        backendToken: `e2e-${role}`,
        backendExpiresAt: new Date(
          Date.now() + (role === "expired" ? -1000 : 3600_000),
        ).toISOString(),
      },
    }),
    url: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    httpOnly: true,
    sameSite: "Lax" as const,
  }
}

export const test = base.extend({
  context: async ({ context }, provide) => {
    if (process.env.E2E_AUTH_SECRET) await context.addCookies([await sessionCookie()])
    await provide(context)
  },
})
export { expect }
