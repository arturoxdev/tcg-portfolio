import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  // better-sqlite3 es un módulo nativo (.node); no debe ser bundleado por
  // Turbopack/webpack en el server bundle. Se carga como external en runtime.
  serverExternalPackages: ["better-sqlite3"],
}

export default nextConfig
