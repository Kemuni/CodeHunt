// Только тестовый сервер. Не импортируется приложением и не подключается к БД/GitHub.
import { createServer } from "node:http"

const revoked = new Set()
createServer((request, response) => {
  const token = request.headers.authorization?.replace(/^Bearer /, "")
  const role = token === "e2e-admin" ? "admin" : token === "e2e-member" ? "member" : null
  const authenticated = role && !revoked.has(token)
  const reply = (status, data) => {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" })
    response.end(JSON.stringify({ success: status === 200, data }))
  }
  if (request.url === "/health") return reply(200, null)
  if (request.url === "/api/auth/logout") {
    if (token) revoked.add(token)
    return reply(200, null)
  }
  if (request.url === "/api/auth/me")
    return authenticated
      ? reply(200, {
          id: role === "admin" ? 1 : 2,
          email: `${role}@example.test`,
          is_admin: role === "admin",
        })
      : reply(401, null)
  if (request.url.startsWith("/api/editor/")) {
    if (!authenticated) return reply(401, null)
    if (role !== "admin") return reply(403, null)
    return reply(200, { items: [], total: 0, limit: 20, offset: 0 })
  }
  return reply(404, null)
}).listen(8101, "127.0.0.1")
