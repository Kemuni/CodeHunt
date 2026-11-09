import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Дожидаемся проверки существования/доступа в metadata до отправки HTML: реальный 404.
  htmlLimitedBots: /.*/,
}

export default nextConfig
