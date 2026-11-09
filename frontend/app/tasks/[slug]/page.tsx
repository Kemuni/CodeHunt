import type { Metadata } from "next"
import TaskDetails from "@/components/tasks/task-details"
import { publicTask } from "@/lib/api/server-tasks"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const task = await publicTask((await params).slug)
  return {
    title: `${task.title} — Track Dev`,
    description: task.short_description,
    openGraph: { title: task.title, description: task.short_description, type: "article" },
    robots: task.is_paid ? { index: false, follow: false } : undefined,
  }
}

export default async function TaskPage({ params }: Props) {
  const { slug } = await params
  const task = await publicTask(slug)
  return <TaskDetails slug={slug} initialTask={task} />
}
