import '@testing-library/jest-dom/vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, vi } from 'vitest'
import 'vue'
import DOMPurify from 'dompurify'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

/**
 * Unit tests must never perform real network I/O.
 *
 * happy-dom serves the page from `http://localhost:3000` (vitest's default
 * environment URL), so any un-mocked relative `fetch('/api/...')` becomes a
 * real TCP connection to a port nothing is listening on. The request outlives
 * the test that started it, and when it finally fails the resulting
 * `console.error` is emitted after vitest has torn the environment down:
 *
 *   EnvironmentTeardownError: [vitest-worker]: Closing rpc while
 *   "onUserConsoleLog" was pending
 *
 * Vitest counts that as an unhandled error and exits non-zero even when every
 * test passed, which silently evicts PRs from the merge queue.
 *
 * Rejecting immediately keeps the failure inside the test that caused it,
 * where it is attributable and fixable. Tests that need network behaviour must
 * mock the module that issues the request, or stub `fetch` themselves - a
 * local stub replaces this guard.
 */
const originalFetch = globalThis.fetch

function resolveRequestUrl(input: RequestInfo | URL): string {
  const requestedUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

  try {
    return new URL(requestedUrl, globalThis.location?.href).href
  } catch {
    return requestedUrl
  }
}

const blockedNetworkFetch: typeof globalThis.fetch = (input, init) => {
  const requestUrl = resolveRequestUrl(input)

  if (!/^https?:/i.test(requestUrl)) {
    return originalFetch(input, init)
  }

  return Promise.reject(
    new Error(
      `Blocked a real network request to ${requestUrl} from a unit test. ` +
        'Mock the module that issues it (or stub globalThis.fetch in the ' +
        'test) instead of letting the request escape - see vitest.setup.ts.'
    )
  )
}

globalThis.fetch = blockedNetworkFetch

// Mock @sparkjsdev/spark which uses WASM that doesn't work in Node.js
vi.mock('@sparkjsdev/spark', async () => {
  const three = await import('three')
  return {
    SplatMesh: class SplatMesh {
      constructor() {}
    },
    SparkRenderer: class SparkRenderer extends three.Object3D {
      constructor() {
        super()
      }
    }
  }
})

// Augment Window interface for tests
declare global {
  interface Window {
    __CONFIG__: {
      mixpanel_token?: string
      require_whitelist?: boolean
      subscription_required?: boolean
      max_upload_size?: number
      comfy_api_base_url?: string
      comfy_platform_base_url?: string
      firebase_config?: {
        apiKey: string
        authDomain: string
        databaseURL?: string
        projectId: string
        storageBucket: string
        messagingSenderId: string
        appId: string
        measurementId?: string
      }
      server_health_alert?: {
        message: string
        tooltip?: string
        severity?: 'info' | 'warning' | 'error'
        badge?: string
      }
    }
  }
}

// Define global variables for tests
globalThis.__COMFYUI_FRONTEND_VERSION__ = '1.24.0'
globalThis.__SENTRY_DSN__ = ''
globalThis.__ALGOLIA_APP_ID__ = ''
globalThis.__ALGOLIA_API_KEY__ = ''
globalThis.__USE_PROD_CONFIG__ = false
globalThis.__DISTRIBUTION__ = 'localhost'
globalThis.__IS_NIGHTLY__ = false

// Define runtime config for tests (absent in @vitest-environment node files)
if (globalThis.window) {
  window.__CONFIG__ = {
    subscription_required: true,
    mixpanel_token: 'test-token',
    comfy_api_base_url: 'https://stagingapi.comfy.org',
    comfy_platform_base_url: 'https://stagingplatform.comfy.org',
    firebase_config: {
      apiKey: 'test',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test',
      storageBucket: 'test.appspot.com',
      messagingSenderId: '123',
      appId: '123'
    }
  }
}

// Mock Worker for extendable-media-recorder
globalThis.Worker = vi.fn(function () {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }
})

// Tripwire: dompurify >= 3.4.8 is inert under happy-dom.
// Root cause (capricorn86/happy-dom#2182, FE-1189): happy-dom's
// Node.prototype.nodeName getter returns '' when invoked directly on an
// element. dompurify 3.4.8 started reading tag names through that
// prototype getter as a DOM-clobbering defense, so under happy-dom every
// node gets an empty tag name and the ALLOWED_TAGS logic misfires in both
// directions: allowed wrappers are dropped and disallowed content
// (<script>, javascript: URLs) survives. jsdom implements the getter
// correctly; dompurify output there matches the pre-3.4.8 control.
// Sanitizer tests therefore run under jsdom (per-file pragma), and this
// wrapper makes it impossible to assert against the inert sanitizer
// silently: throwing on call (not on load) leaves the ~16k tests that
// never sanitize unaffected.
if (
  typeof DOMPurify?.sanitize === 'function' &&
  DOMPurify.sanitize('<h1>x</h1>') !== '<h1>x</h1>'
) {
  DOMPurify.sanitize = (() => {
    throw new Error(
      'DOMPurify.sanitize is inert in this test environment (happy-dom ' +
        'Node.prototype.nodeName bug — see vitest.setup.ts). Add ' +
        '`// @vitest-environment jsdom` to this test file.'
    )
  }) as typeof DOMPurify.sanitize
}
