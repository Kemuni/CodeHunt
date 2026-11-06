"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { tasksApi } from "@/lib/api/tasks"
import { PageLayout, PageLayoutHeader, PageLayoutContent } from "@/components/ui/layouts/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {PlusIcon} from "lucide-react";

/** Публичный каталог и административный список. Собственные черновики запрашиваются отдельным API только в административном режиме. */
export default function TaskCatalog({ admin = false }: { admin?: boolean }) {
  const [tab, setTab] = useState("tasks")
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const drafts = admin && tab === "drafts"
  const tasksQuery = useQuery({
    queryKey: ["task-catalog", admin, "tasks", offset, query],
    queryFn: () => tasksApi.list(admin, offset, query),
    enabled: !drafts,
    retry: false,
  })
  const draftsQuery = useQuery({
    queryKey: ["task-catalog", true, "drafts", offset],
    queryFn: () => tasksApi.drafts(offset),
    enabled: drafts,
    retry: false,
  })
  const result = drafts ? draftsQuery : tasksQuery
  const total = result.data?.total ?? 0
  return (
    <PageLayout>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageLayoutHeader>{admin ? "Управление задачами" : "Каталог задач"}</PageLayoutHeader>
        {admin && (
          <Button render={<Link href="/admin/tasks/editor" />} nativeButton={false}>
            <PlusIcon />
            Добавить задачу
          </Button>
        )}
      </div>
      <PageLayoutContent>
        {admin ? (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(String(value))
              setOffset(0)
            }}
          >
            <TabsList>
              <TabsTrigger value="tasks">Все задачи</TabsTrigger>
              <TabsTrigger value="drafts">Мои черновики</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <div className="flex gap-2">
            <Input
              aria-label="Поиск задач"
              placeholder="Поиск по задачам"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setQuery(search)
                  setOffset(0)
                }
              }}
            />
            <Button
              onClick={() => {
                setQuery(search)
                setOffset(0)
              }}
            >
              Найти
            </Button>
          </div>
        )}
        {result.isPending ? (
          <p role="status">Загружаем…</p>
        ) : result.error ? (
          <div role="alert">
            <p className="text-destructive">{result.error.message}</p>
            <Button variant="outline" className="mt-3" onClick={() => void result.refetch()}>
              Повторить
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Всего: {total}</p>
            {!total && (
              <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                {drafts ? "У вас пока нет черновиков" : "Задач пока нет"}
              </p>
            )}
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {drafts
                ? draftsQuery.data?.items.map((draft) => (
                    <Card key={draft.id}>
                      <CardHeader>
                        <CardTitle>
                          {typeof draft.payload.title === "string" && draft.payload.title
                            ? draft.payload.title
                            : "Без названия"}
                        </CardTitle>
                        <CardDescription>Черновик #{draft.id}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p>
                          {draft.is_valid
                            ? "Готов к публикации"
                            : `Проблем с валидацией: ${draft.validation_errors.length}`}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Фото: {draft.photos.length} · Вложения: {draft.resources.length}
                        </p>
                      </CardContent>
                      <CardFooter>
                        <Button
                          render={<Link href={`/admin/tasks/editor?draftId=${draft.id}`} />}
                          nativeButton={false}
                          variant="outline"
                        >
                          Продолжить редактирование
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                : tasksQuery.data?.items.map((task) => (
                    <Card key={task.id}>
                      <CardHeader>
                        <CardTitle>{task.title}</CardTitle>
                        <CardDescription>
                          {task.developer_type === "frontend" ? "Фронтенд" : "Фуллстек"} · Сложность{" "}
                          {task.difficulty_from}–{task.difficulty_to}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap wrap-anywhere">
                          {task.short_description}
                        </p>
                        {admin && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            {task.status === "archived" ? "В архиве" : "Опубликована"}
                            {task.is_hidden ? " · Скрыта" : ""}
                          </p>
                        )}
                      </CardContent>
                      <CardFooter className="mt-auto">
                        <Button
                          render={
                            <Link
                              href={
                                admin
                                  ? `/admin/tasks/editor?taskId=${task.id}`
                                  : `/tasks/${task.id}`
                              }
                            />
                          }
                          nativeButton={false}
                          variant="outline"
                        >
                          {admin ? "Редактировать" : "Открыть задачу"}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
            </div>
            {total > 20 && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  disabled={!offset}
                  onClick={() => setOffset((value) => Math.max(0, value - 20))}
                >
                  Назад
                </Button>
                <span>
                  {Math.floor(offset / 20) + 1} / {Math.ceil(total / 20)}
                </span>
                <Button
                  variant="outline"
                  disabled={offset + 20 >= total}
                  onClick={() => setOffset((value) => value + 20)}
                >
                  Далее
                </Button>
              </div>
            )}
          </>
        )}
      </PageLayoutContent>
    </PageLayout>
  )
}
