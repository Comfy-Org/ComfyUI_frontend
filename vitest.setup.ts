import { vi } from 'vitest'
import 'vue'

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

// Mock Worker for extendable-media-recorder
globalThis.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}))
