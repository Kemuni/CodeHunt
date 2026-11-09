import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; isAdmin: boolean }
    error?: "SessionExpired" | "SessionUnavailable"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendToken?: string
    backendExpiresAt?: string
  }
}
