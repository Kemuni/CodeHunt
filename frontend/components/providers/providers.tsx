"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { Toaster } from "sonner"
import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

export function Provider({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: 1 },
          queries: { staleTime: 60_000 },
        },
      }),
  )

  return (
    // null означает гостя; переданная с сервера сессия убирает начальный запрос и мигание шапки.
    <SessionProvider session={session}>
      <QueryClientProvider client={client}>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </QueryClientProvider>
    </SessionProvider>
  )
}
