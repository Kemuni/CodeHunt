import type { NextConfig } from "next"

const nextConfig: NextConfig = {}

module.exports = {
  images: {
  dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
    remotePatterns: [
        {
            protocol: 'http',
            hostname: 'localhost',
            port: '9000',
            pathname: '/**'
        }
    ]
  }
}

export default nextConfig
