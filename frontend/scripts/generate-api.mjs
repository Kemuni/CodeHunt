import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { execFileSync } from "node:child_process"

import { createClient } from "@hey-api/openapi-ts"

const frontendRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const projectRoot = resolve(frontendRoot, "..")

// Сборка гарантирует, что схема берётся из текущих исходников, а не из старого контейнера.
execFileSync("docker", ["compose", "build", "backend"], { cwd: projectRoot, stdio: "inherit" })
const rawSpec = execFileSync(
  "docker",
  [
    "compose",
    "run",
    "--rm",
    "--no-deps",
    "-T",
    "--entrypoint",
    "python",
    "backend",
    "-c",
    "import json; from app.main import app; print(json.dumps(app.openapi()))",
  ],
  {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  },
)
const spec = JSON.parse(rawSpec)
if (!spec.paths || typeof spec.paths !== "object") throw new Error("В OpenAPI нет paths")

// В браузере /api/backend/... проксируется в /api/... на backend.
const paths = {}
for (const [path, operations] of Object.entries(spec.paths)) {
  if (!path.startsWith("/api/")) throw new Error(`Неожиданный путь OpenAPI: ${path}`)
  const proxyPath = path.slice("/api".length)
  if (paths[proxyPath]) throw new Error(`Повторяющийся путь OpenAPI: ${proxyPath}`)
  paths[proxyPath] = operations
}
spec.paths = paths
spec.servers = [{ url: "/api/backend" }]

await createClient({
  input: spec,
  output: resolve(frontendRoot, "lib/api/generated"),
  plugins: ["@hey-api/client-fetch", "@hey-api/typescript", "@hey-api/sdk"],
})
