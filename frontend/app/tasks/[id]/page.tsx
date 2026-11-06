import { notFound } from "next/navigation"
import TaskDetails from "@/components/tasks/task-details"

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id) || Number(id) <= 0 || !Number.isSafeInteger(Number(id))) notFound()
  return <TaskDetails id={Number(id)} />
}
