import { vi } from 'vitest'
import 'vue'

// Mock firebaseAuthStore to break circular dependency in rh-test branch
// Circular chain: api -> firebaseAuthStore -> dialogService -> components -> settingStore -> app -> ComfyUI -> api
// This is a test-only fix to prevent module initialization failures
vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({
    getAuthHeader: vi.fn(),
    getIdToken: vi.fn(),
    isAuthenticated: false,
    user: null
  }))
}))

// Augment Window interface for tests
declare global {
  interface Window {
    __CONFIG__: {
      mixpanel_token?: string
      subscription_required?: boolean
      server_health_alert?: string
    }
  }
}

// Define global variables for tests
// @ts-expect-error - Global variables are defined in global.d.ts
globalThis.__COMFYUI_FRONTEND_VERSION__ = '1.24.0'
// @ts-expect-error - Global variables are defined in global.d.ts
globalThis.__SENTRY_ENABLED__ = false
// @ts-expect-error - Global variables are defined in global.d.ts
globalThis.__SENTRY_DSN__ = ''
// @ts-expect-error - Global variables are defined in global.d.ts
globalThis.__ALGOLIA_APP_ID__ = ''
// @ts-expect-error - Global variables are defined in global.d.ts
globalThis.__ALGOLIA_API_KEY__ = ''
// @ts-expect-error - Global variables are defined in global.d.ts
globalThis.__USE_PROD_CONFIG__ = false
globalThis.__DISTRIBUTION__ = 'localhost'

// Define runtime config for tests
window.__CONFIG__ = {
  subscription_required: true,
  mixpanel_token: 'test-token'
}

// Mock Worker for extendable-media-recorder
globalThis.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}))
