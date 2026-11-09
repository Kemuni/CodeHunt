import type { NextAuthOptions } from "next-auth"
import { cache } from "react"
import { getServerSession } from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import { backendOrigin } from "./lib/backend-origin"

export const config: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
      authorization: { params: { scope: "read:user user:email" } },
      checks: ["pkce", "state"],
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        if (account.provider !== "github" || !account.access_token)
          throw new Error("GitHubLoginFailed")
        const response = await fetch(`${backendOrigin}/api/auth/github`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: account.access_token }),
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        })
        if (!response.ok) throw new Error("GitHubLoginFailed")
        const { data } = await response.json()
        token.backendToken = data.token
        token.backendExpiresAt = data.expires_at
      }
      return token
    },
    async session({ session, token }) {
      // Секрет сессии остаётся в зашифрованной HttpOnly cookie, не в /api/auth/session.
      session.error = "SessionExpired"
      if (!token.backendToken || !(Date.parse(token.backendExpiresAt ?? "") > Date.now()))
        return session
      try {
        const response = await fetch(`${backendOrigin}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token.backendToken}` },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        })
        if (!response.ok) return session
        const { data } = await response.json()
        session.user = {
          ...session.user,
          id: String(data.id),
          email: data.email,
          isAdmin: data.is_admin,
        }
        delete session.error
      } catch {
        session.error = "SessionUnavailable"
      }
      return session
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.backendToken) {
        try {
          await fetch(`${backendOrigin}/api/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token.backendToken}` },
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
          })
        } catch {
          // Cookie удаляется даже при недоступности backend; сессия имеет конечный TTL.
          console.error("Не удалось отозвать backend-сессию при выходе")
        }
      }
    },
  },
}

export const auth = cache(() => getServerSession(config))
