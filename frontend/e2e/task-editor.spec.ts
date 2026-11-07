import { test, expect } from "@playwright/test"

// Запуск только с явным выбором локального API: тест создаёт свои данные и удаляет их в finally.
test.skip(process.env.E2E_LIVE_API !== "1", "Нужен запущенный backend и E2E_LIVE_API=1")

test("draft autosave, attachments, publication and explicit updates of an existing task", async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const title = `Проверка frontend ${stamp}`
  let draftId: number | undefined
  let taskId: number | undefined
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const api = async (path: string) => {
    const response = await request.get(`/api/backend/${path}`)
    const json = await response.json()
    expect(response.ok(), JSON.stringify(json)).toBeTruthy()
    expect(json.success).toBe(true)
    return json.data
  }
  const beforeDrafts = await api("editor/task-drafts?limit=100")
  try {
    await page.goto("/admin/tasks/editor")
    await expect(page.getByLabel("Название задачи", { exact: true })).toBeVisible()
    expect((await api("editor/task-drafts?limit=100")).total).toBe(beforeDrafts.total)
    await page.getByLabel("Название задачи", { exact: true }).fill(title)
    await expect(page).toHaveURL(/draftId=\d+/)
    draftId = Number(new URL(page.url()).searchParams.get("draftId"))
    await expect(page.getByText("Что нужно исправить перед сохранением задачи")).toBeVisible()
    await expect
      .poll(async () => (await api(`editor/task-drafts/${draftId}`)).payload.title)
      .toBe(title)
    await page.reload()
    await expect(page.getByLabel("Название задачи", { exact: true })).toHaveValue(title)
    await page.getByLabel("Адрес задачи (slug)").fill(`frontend-test-${stamp}`)
    await page
      .getByLabel("Краткое описание задачи", { exact: true })
      .fill("Краткое описание интеграционного теста")
    await page
      .getByLabel("Общее описание", { exact: true })
      .fill("Полное описание интеграционного теста")
    await page.getByRole("combobox").click()
    await page.getByRole("option", { name: "Фронтенд", exact: true }).click()
    await page.locator('[id="presets.easy.description"]').fill("Базовый результат")
    await page.locator('[id="presets.easy.averageDays"]').fill("3")
    await page.getByRole("tab", { name: "Продвинутый (0 пунктов)", exact: true }).click()
    await page.locator('[id="presets.medium.description"]').fill("Продвинутый результат")
    await expect
      .poll(async () => (await api(`editor/task-drafts/${draftId}`)).payload.presets.length)
      .toBe(2)
    await page.locator('[id="presets.medium.description"]').fill("")
    await expect
      .poll(async () => (await api(`editor/task-drafts/${draftId}`)).payload.presets.length)
      .toBe(1)
    await page.getByRole("tab", { name: "Базовый (0 пунктов)", exact: true }).click()
    await expect(page.locator('[id="presets.easy.description"]')).toHaveValue("Базовый результат")
    await expect(page.getByRole("heading", { name: "Уровни задачи", exact: true })).toHaveCount(0)
    await page.getByRole("button", { name: "Добавить пункт", exact: true }).click()
    await page.getByLabel("Название пункта", { exact: true }).fill("Обязательный пункт")
    await page.getByLabel("Описание", { exact: true }).fill("Выполнить условие")
    await page.getByLabel("Критерии проверки", { exact: true }).fill("Условие выполнено")
    await expect(page.locator("form form")).toHaveCount(0)
    await page.getByRole("button", { name: "Сохранить", exact: true }).click()
    await expect
      .poll(async () => (await api(`editor/task-drafts/${draftId}`)).payload.items?.length)
      .toBe(1)
    await expect(page.getByLabel("Загрузить фотографии")).toBeEnabled()
    await page.getByLabel("Загрузить фотографии").setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP4z8AARGDiPwMAHfAD/aAzCYkAAAAASUVORK5CYII=",
        "base64",
      ),
    })
    await expect(page.getByRole("img", { name: "test.png", exact: true })).toBeVisible()
    await expect
      .poll(() =>
        page
          .getByRole("img", { name: "test.png", exact: true })
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0)
    await expect(page.getByLabel("Прикрепить файлы")).toBeEnabled()
    await page.getByLabel("Прикрепить файлы").setInputFiles({
      name: "integration.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Frontend integration"),
    })
    await expect(
      page.getByRole("button", { name: "Скачать integration.txt", exact: true }),
    ).toBeVisible()
    const savedDraft = await api(`editor/task-drafts/${draftId}`)
    expect(savedDraft.photos).toHaveLength(1)
    expect(savedDraft.resources).toHaveLength(1)
    expect(savedDraft.payload.presets).toEqual([
      { level: "easy", description: "Базовый результат", average_days_to_complete: 3 },
    ])
    expect(savedDraft.is_valid, JSON.stringify(savedDraft.validation_errors)).toBe(true)
    await page.getByRole("button", { name: "Сохранить задачу", exact: true }).click()
    await expect(page).toHaveURL(/taskId=\d+/)
    taskId = Number(new URL(page.url()).searchParams.get("taskId"))
    await expect(page.getByLabel("Название задачи", { exact: true })).toHaveValue(title)
    const published = await api(`tasks/${taskId}`)
    expect(published.photos).toHaveLength(1)
    expect(published.resources).toHaveLength(1)
    expect(published.presets.easy.complications).toHaveLength(1)
    await page.getByRole("button", { name: "Действия: Обязательный пункт", exact: true }).click()
    await page.getByRole("menuitem", { name: "Изменить пункт", exact: true }).click()
    await page.getByLabel("Критерии проверки", { exact: true }).fill("Обновлённый критерий")
    await page.getByRole("button", { name: "Сохранить", exact: true }).click()
    expect(
      (await api(`editor/tasks/${taskId}`)).presets.easy.complications[0].acceptance_criteria,
    ).toBe("Условие выполнено")
    const draftsAfterPublish = (await api("editor/task-drafts?limit=100")).total
    await page.getByLabel("Название задачи", { exact: true }).fill(`${title} изменено`)
    await page.waitForTimeout(1000)
    expect((await api(`editor/tasks/${taskId}`)).title).toBe(title)
    expect((await api("editor/task-drafts?limit=100")).total).toBe(draftsAfterPublish)
    await page.getByLabel("Загрузить фотографии").setInputFiles({
      name: "second.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP4z8AARGDiPwMAHfAD/aAzCYkAAAAASUVORK5CYII=",
        "base64",
      ),
    })
    await expect(
      page.getByText("Фотографии добавлены. Изменения уже сохранены в задаче."),
    ).toBeVisible()
    expect((await api(`editor/tasks/${taskId}`)).photos).toHaveLength(2)
    await page.getByRole("button", { name: "На обложку", exact: true }).click()
    await expect
      .poll(async () => (await api(`editor/tasks/${taskId}`)).photos[0].original_filename)
      .toBe("second.png")
    await page.getByRole("button", { name: "Удалить test.png", exact: true }).click()
    await expect.poll(async () => (await api(`editor/tasks/${taskId}`)).photos.length).toBe(1)
    expect((await api(`editor/tasks/${taskId}`)).title).toBe(title)
    await page.getByLabel("Прикрепить файлы").setInputFiles({
      name: "existing.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Immediate upload"),
    })
    await expect(page.getByText("Файлы добавлены. Изменения уже сохранены в задаче.")).toBeVisible()
    expect((await api(`editor/tasks/${taskId}`)).resources).toHaveLength(2)
    await page.getByRole("button", { name: "Удалить integration.txt", exact: true }).click()
    await expect(page.getByText("Файл удалён. Изменения уже сохранены в задаче.")).toBeVisible()
    expect((await api(`editor/tasks/${taskId}`)).resources).toHaveLength(1)
    expect((await api(`editor/tasks/${taskId}`)).title).toBe(title)
    await page.getByRole("button", { name: "Сохранить задачу", exact: true }).click()
    await expect(page.getByText("Основная информация и пункты задачи сохранены")).toBeVisible()
    expect((await api(`editor/tasks/${taskId}`)).title).toBe(`${title} изменено`)
    const savedItem = (await api(`editor/tasks/${taskId}`)).presets.easy.complications[0]
    expect(savedItem.id).toBe(published.presets.easy.complications[0].id)
    expect(savedItem.acceptance_criteria).toBe("Обновлённый критерий")
    await page.getByRole("button", { name: "Посмотреть second.png", exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.getByRole("button", { name: "Очистить все", exact: true }).click()
    await expect.poll(async () => (await api(`editor/tasks/${taskId}`)).photos.length).toBe(0)
    await page.goto("/admin/tasks")
    await expect(page.getByText(`${title} изменено`, { exact: true })).toBeVisible()
    await page.goto(`/tasks/${taskId}`)
    await expect(
      page.getByRole("heading", { name: `${title} изменено`, exact: true }),
    ).toBeVisible()
    await expect(page.getByText("Обязательный пункт", { exact: true })).toBeVisible()
    const attachment = (await api(`tasks/${taskId}`)).resources[0]
    const download = await api(`tasks/${taskId}/resources/${attachment.id}/download-url`)
    expect(await (await request.get(download.url)).text()).toBe("Immediate upload")
    expect(errors).toEqual([])
  } finally {
    if (taskId) {
      await request.patch(`/api/backend/editor/tasks/${taskId}`, { data: { status: "archived" } })
      const response = await request.delete(`/api/backend/editor/tasks/${taskId}`)
      expect(response.ok()).toBeTruthy()
    } else if (draftId) {
      const current = await api(`editor/task-drafts/${draftId}`)
      await request.delete(
        `/api/backend/editor/task-drafts/${draftId}?revision=${current.revision}`,
      )
    }
  }
})

test("failed autosave reports a toast, retries and protects local edits on revision conflict", async ({
  page,
  request,
}) => {
  let draftId: number | undefined
  const route = "**/api/backend/editor/task-drafts"
  try {
    await page.route(route, async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      await route.fulfill({
        status: 503,
        json: {
          success: false,
          errors: { code: "test_unavailable", message: "Тест: сервер временно недоступен" },
        },
      })
    })
    await page.goto("/admin/tasks/editor")
    await page.getByLabel("Название задачи", { exact: true }).fill("Тест ошибки автосохранения")
    await expect(
      page
        .locator("[data-sonner-toast]")
        .getByText("Тест: сервер временно недоступен", { exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel("Название задачи", { exact: true })).toHaveValue(
      "Тест ошибки автосохранения",
    )
    expect(new URL(page.url()).searchParams.has("draftId")).toBe(false)
    await page.unroute(route)
    await page.getByRole("button", { name: "Повторить сохранение", exact: true }).click()
    await expect(page).toHaveURL(/draftId=\d+/)
    draftId = Number(new URL(page.url()).searchParams.get("draftId"))
    const draft = (await (await request.get(`/api/backend/editor/task-drafts/${draftId}`)).json())
      .data
    const changed = await request.patch(`/api/backend/editor/task-drafts/${draftId}`, {
      data: {
        revision: draft.revision,
        payload: { ...draft.payload, title: "Правки из другого окна" },
      },
    })
    expect(changed.ok()).toBeTruthy()
    await page.getByLabel("Название задачи", { exact: true }).fill("Мои несохранённые правки")
    const reload = page.getByRole("button", {
      name: "Загрузить версию с сервера (локальные правки будут потеряны)",
      exact: true,
    })
    await expect(reload).toBeVisible()
    await expect(page.locator("[data-sonner-toast][data-type=error]")).not.toHaveCount(0)
    await expect(page.getByLabel("Название задачи", { exact: true })).toHaveValue(
      "Мои несохранённые правки",
    )
    await expect(page.getByRole("button", { name: "Сохранить задачу", exact: true })).toBeDisabled()
    page.once("dialog", (dialog) => void dialog.accept())
    await reload.click()
    await expect(page.getByLabel("Название задачи", { exact: true })).toHaveValue(
      "Правки из другого окна",
    )
  } finally {
    if (draftId) {
      const draft = (await (await request.get(`/api/backend/editor/task-drafts/${draftId}`)).json())
        .data
      const response = await request.delete(
        `/api/backend/editor/task-drafts/${draftId}?revision=${draft.revision}`,
      )
      expect(response.ok()).toBeTruthy()
    }
  }
})
