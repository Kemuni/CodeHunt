/** Загружает файл с обычным HTTP-кешем браузера и проверяет ответ до сохранения. */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Не удалось скачать файл. Попробуйте ещё раз.")
  const objectUrl = URL.createObjectURL(await response.blob())
  try {
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = filename
    anchor.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
}
