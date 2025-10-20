import { vi } from 'vitest'
import 'vue'

// Define global variables for tests
globalThis.__COMFYUI_FRONTEND_VERSION__ = '1.24.0'
globalThis.__SENTRY_ENABLED__ = false
globalThis.__SENTRY_DSN__ = ''
globalThis.__ALGOLIA_APP_ID__ = ''
globalThis.__ALGOLIA_API_KEY__ = ''
globalThis.__USE_PROD_CONFIG__ = false
globalThis.__DISTRIBUTION__ = 'localhost'
globalThis.__BUILD_FLAGS__ = {
  REQUIRE_SUBSCRIPTION: true
}

// Mock Worker for extendable-media-recorder
globalThis.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}))
