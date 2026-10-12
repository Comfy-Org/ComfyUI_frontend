/**
 * Shim for Vite define variables to make them available during Playwright test execution
 * This file should be imported before any code that uses Vite define variables
 */

type GlobalWithDefines = typeof globalThis & {
  __COMFYUI_FRONTEND_VERSION__: string
  __SENTRY_DSN__: string
  __ALGOLIA_APP_ID__: string
  __ALGOLIA_API_KEY__: string
  __USE_PROD_CONFIG__: boolean
  __DISTRIBUTION__: 'desktop' | 'localhost' | 'cloud'
  __IS_NIGHTLY__: boolean
  window?: Record<string, unknown>
}

const globalWithDefines = globalThis as GlobalWithDefines

// Set default values for Playwright test environment
globalWithDefines.__COMFYUI_FRONTEND_VERSION__ =
  process.env.npm_package_version || '1.0.0'
globalWithDefines.__SENTRY_DSN__ = ''
globalWithDefines.__ALGOLIA_APP_ID__ = ''
globalWithDefines.__ALGOLIA_API_KEY__ = ''
globalWithDefines.__USE_PROD_CONFIG__ = false
globalWithDefines.__DISTRIBUTION__ = 'localhost'
globalWithDefines.__IS_NIGHTLY__ = false

// Provide a minimal window shim for Node environment
// This is needed for code that checks window existence during imports
if (typeof window === 'undefined') {
  Object.assign(globalWithDefines, { window: {} })
}

export {}
