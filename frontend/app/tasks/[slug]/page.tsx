import { notFound } from "next/navigation"
import TaskDetails from "@/components/tasks/task-details"

export default async function TaskPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (slug.length > 255 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound()
  return <TaskDetails slug={slug} />
}
