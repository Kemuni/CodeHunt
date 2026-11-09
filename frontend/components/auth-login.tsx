"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function AuthLogin({ callbackUrl, hasError }: { callbackUrl: string; hasError: boolean }) {
  return (
    <div className="flex flex-col items-start gap-4">
      {hasError && (
        <p role="alert">
          Не удалось войти. Проверьте, что в GitHub есть подтверждённый email, и попробуйте снова.
        </p>
      )}
      <Button onClick={() => signIn("github", { callbackUrl })}>Войти через GitHub</Button>
    </div>
  )
}
