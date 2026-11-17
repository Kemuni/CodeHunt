import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  distDir: process.env.E2E_ISOLATED_AUTH === "1" ? ".next-e2e" : ".next",
  // Дожидаемся проверки существования/доступа в metadata до отправки HTML: реальный 404.
  htmlLimitedBots: /.*/,
}

export default nextConfig
