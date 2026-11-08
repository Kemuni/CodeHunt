import TaskCatalog from "@/components/tasks/task-catalog"
import TaskLibraryManager from "@/components/tasks/library/task-library-manager"

export default function AdminTasksPage() {
  return <TaskCatalog admin adminActions={<TaskLibraryManager />} />
}
