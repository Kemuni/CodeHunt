// Адрес для серверных запросов Next.js; внутренний URL имеет приоритет над публичным.
export const backendOrigin = (
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "")
