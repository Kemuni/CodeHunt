import { getToken } from "next-auth/jwt"
import { NextRequest } from "next/server"

/** Читаем только зашифрованную cookie: клиентский Authorization не определяет пользователя. */
export async function backendSessionToken(cookie: string): Promise<string | null> {
  const request = new NextRequest(process.env.NEXTAUTH_URL ?? "http://localhost", {
    headers: { cookie },
  })
  const session = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  return session?.backendToken && Date.parse(session.backendExpiresAt ?? "") > Date.now()
    ? session.backendToken
    : null
}
