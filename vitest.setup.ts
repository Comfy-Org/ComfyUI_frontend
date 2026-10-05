import '@testing-library/jest-dom/vitest'
import { createTestingPinia } from '@pinia/testing'
import { disposePinia, setActivePinia } from 'pinia'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, vi } from 'vitest'
import { TooltipProvider } from 'reka-ui'
import { shallowReactive } from 'vue'
import type { Plugin } from 'vue'

import './vitest.network.setup'

import { clearRegisteredLiteGraphTypes } from '@/lib/litegraph/src/litegraphInstance'
import { remoteConfigState } from '@/platform/remoteConfig/remoteConfig'
import { StubPath2D } from '@/utils/__tests__/stubPath2D'

const requireFromTestingLibrary = createRequire(
  createRequire(import.meta.url).resolve('@testing-library/vue')
)
const { config }: { config: { global: { plugins: Plugin[] } } } =
  requireFromTestingLibrary('@vue/test-utils')

const appTooltipProviderProps = {
  delayDuration: 300,
  skipDelayDuration: 300,
  disableHoverableContent: true,
  disableClosingTrigger: undefined,
  disabled: undefined,
  ignoreNonKeyboardFocus: true
}

const appShellTooltipProvider: Plugin = {
  install(app) {
    const root = app._component
    if (typeof root === 'function' || !root.setup) return
    const setupRoot = root.setup
    root.setup = (props, ctx) => {
      TooltipProvider.setup?.(shallowReactive(appTooltipProviderProps), ctx)
      return setupRoot(props, ctx)
    }
  }
}
config.global.plugins.push(appShellTooltipProvider)

beforeEach(({ task }) => {
  for (
    let current: typeof task | typeof task.suite = task;
    current;
    current = current.suite
  ) {
    if (current.concurrent) {
      throw new Error(
        'Frontend setup shares Pinia, timers, and DOM state. ' +
          'Keep this test and its ancestor suites sequential, or move it to ' +
          'a project with test-owned fixtures and no frontend setup.'
      )
    }
  }

  vi.stubGlobal('__VUE_DEVTOOLS_GLOBAL_HOOK__', { emit: vi.fn() })
  vi.stubGlobal('Path2D', StubPath2D)
  const pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)
  remoteConfigState.value = 'anonymous'

  return () => disposePinia(pinia)
})

afterEach(() => {
  clearRegisteredLiteGraphTypes()
})

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
