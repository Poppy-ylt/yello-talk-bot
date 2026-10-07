import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // The repository has a root lockfile plus the portal lockfile. Align the
  // Turbopack workspace with Vercel's output tracing root so both local and
  // production builds resolve the same dependency graph.
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
  ],
}

export default nextConfig
