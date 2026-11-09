import type { TaskDetail } from "../lib/api/task-contract"

/** SSR обращается к тестовому backend, браузерные route-моки этот запрос не перехватывают. */
export async function registerPublicTask(task: TaskDetail) {
  const response = await fetch("http://127.0.0.1:8101/__fixtures/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  })
  if (!response.ok) throw new Error("Не удалось подготовить SSR-фикстуру")
}
