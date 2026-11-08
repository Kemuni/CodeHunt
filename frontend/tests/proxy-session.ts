import { encode } from "next-auth/jwt"

// Настоящая зашифрованная cookie NextAuth с отдельным тестовым секретом.
process.env.NEXTAUTH_SECRET = "proxy-unit-test-secret"
process.env.NEXTAUTH_URL = "http://localhost"

export async function sessionCookie(expiresAt = Date.now() + 60_000) {
  const jwt = await encode({
    secret: process.env.NEXTAUTH_SECRET!,
    token: {
      backendToken: "session-token",
      backendExpiresAt: new Date(expiresAt).toISOString(),
    },
  })
  return `next-auth.session-token=${jwt}`
}
