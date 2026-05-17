import type { NextConfig } from 'next'

// next-pwa v5 is CommonJS — require() is the correct import style
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Disable service worker in development to avoid caching stale responses
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  // Empty turbopack config silences the "webpack config present" error in dev.
  // next-pwa v5 injects webpack config but is disabled in development anyway.
  turbopack: {},
}

export default withPWA(nextConfig)
