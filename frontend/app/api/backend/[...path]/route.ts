import { proxyBackend } from "@/lib/backend-proxy"

// Один обработчик для всех методов: /api/backend/... на frontend -> /api/... на backend.
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxyBackend(request, path)
}

export { proxy as GET, proxy as HEAD, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE }
