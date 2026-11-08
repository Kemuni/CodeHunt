import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || session.error) redirect("/login?callbackUrl=/admin/tasks")
  if (!session.user.isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Доступ ограничен</h1>
        <p className="mt-4">Этот раздел доступен только администраторам.</p>
      </main>
    )
  }
  return children
}
