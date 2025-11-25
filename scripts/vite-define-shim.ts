/**
 * Shim for Vite define variables to make them available during Playwright test execution
 * This file should be imported before any code that uses Vite define variables
 */

// Define global constants that Vite would normally replace at build time
declare global {
  const __COMFYUI_FRONTEND_VERSION__: string
  const __SENTRY_ENABLED__: boolean
  const __SENTRY_DSN__: string
  const __ALGOLIA_APP_ID__: string
  const __ALGOLIA_API_KEY__: string
  const __USE_PROD_CONFIG__: boolean
  const __DISTRIBUTION__: 'desktop' | 'localhost' | 'cloud'
}

// Set default values for Playwright test environment
;(globalThis as any).__COMFYUI_FRONTEND_VERSION__ =
  process.env.npm_package_version || '1.0.0'
;(globalThis as any).__SENTRY_ENABLED__ = false
;(globalThis as any).__SENTRY_DSN__ = ''
;(globalThis as any).__ALGOLIA_APP_ID__ = ''
;(globalThis as any).__ALGOLIA_API_KEY__ = ''
;(globalThis as any).__USE_PROD_CONFIG__ = false
;(globalThis as any).__DISTRIBUTION__ = 'localhost'

// Provide a minimal window shim for Node environment
// This is needed for code that checks window existence during imports
if (typeof window === 'undefined') {
  ;(globalThis as any).window = {}
}

export {}
