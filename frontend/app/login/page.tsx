import { AuthLogin } from "@/components/auth-login"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const params = await searchParams
  const callbackUrl =
    params.callbackUrl?.startsWith("/") && !params.callbackUrl.startsWith("//")
      ? params.callbackUrl
      : "/"
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-4 text-3xl font-semibold">Вход в CodeHunt</h1>
      <p className="mb-6">При первом входе аккаунт создастся автоматически.</p>
      <AuthLogin callbackUrl={callbackUrl} hasError={Boolean(params.error)} />
    </main>
  )
}
