"use client"

import { Button } from "@/components/ui/button"
import { PageLayout } from "@/components/ui/layouts/page"

export default function TaskError({ reset }: { reset: () => void }) {
  return (
    <PageLayout>
      <p role="alert">Не удалось загрузить задачу. Попробуйте ещё раз.</p>
      <Button className="mt-4" onClick={reset}>
        Повторить
      </Button>
    </PageLayout>
  )
}
