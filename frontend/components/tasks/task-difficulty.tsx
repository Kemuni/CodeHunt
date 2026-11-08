import { BugIcon } from "lucide-react"
import { cn } from "cn"

interface TaskDifficultyProps {
  from: number
  to: number
  className?: string
}

/** Единое отображение диапазона сложности в каталоге и на странице задачи. */
export default function TaskDifficulty({ from, to, className }: TaskDifficultyProps) {
  return (
    <div className={cn("font-heading tracking-wide text-muted-foreground", className)}>
      <span className="sr-only">
        Сложность: {from}–{to} из 10
      </span>
      <span aria-hidden="true" className="flex items-baseline gap-1">
        <span className="flex items-center gap-0.5 text-primary">
          <span className="text-2xl font-medium">
            {from}-{to}
          </span>
          <BugIcon />
        </span>
        /10
      </span>
    </div>
  )
}
