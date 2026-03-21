import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  initializeConflictDetection: vi.fn(),
  localStorage: {
    clear: vi.fn(),
    getItem: vi.fn(() => null),
    key: vi.fn(() => null),
    length: 0,
    removeItem: vi.fn(),
    setItem: vi.fn()
  },
  toastAdd: vi.fn(),
  sessionStorage: {
    clear: vi.fn(),
    getItem: vi.fn(() => null),
    key: vi.fn(() => null),
    length: 0,
    removeItem: vi.fn(),
    setItem: vi.fn()
  },
  workspaceStore: {
    spinner: false
  }
}))

vi.stubGlobal('localStorage', mocks.localStorage)
vi.stubGlobal('sessionStorage', mocks.sessionStorage)

vi.mock('@sentry/vue', () => ({
  captureException: mocks.captureException
}))

vi.mock('@/components/dialog/GlobalDialog.vue', () => ({
  default: {
    name: 'GlobalDialog',
    template: '<div />'
  }
}))

vi.mock('@/config', () => ({
  default: {
    app_title: 'ComfyUI',
    app_version: 'test-version'
  }
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: mocks.toastAdd
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    extensionManager: null
  }
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => mocks.workspaceStore
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => null
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => ({
      initializeConflictDetection: mocks.initializeConflictDetection
    })
  })
)

vi.mock('primevue/blockui', () => ({
  default: {
    name: 'BlockUI',
    props: ['blocked', 'fullScreen'],
    template: '<div><slot /></div>'
  }
}))

import App from './App.vue'

describe('App', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          preloadErrorTitle: 'Resource load failed',
          preloadError: 'A required resource failed to load.'
        }
      }
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    ;(
      globalThis as typeof globalThis & {
        __DISTRIBUTION__: 'desktop' | 'localhost' | 'cloud'
        __IS_NIGHTLY__: boolean
      }
    ).__DISTRIBUTION__ = 'localhost'
    ;(
      globalThis as typeof globalThis & {
        __DISTRIBUTION__: 'desktop' | 'localhost' | 'cloud'
        __IS_NIGHTLY__: boolean
      }
    ).__IS_NIGHTLY__ = false
  })

  it('does not show the preload toast for non-resource preload errors', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {
        // Intentionally silent for the regression test.
      })

    const wrapper = mount(App, {
      global: {
        plugins: [i18n],
        stubs: {
          BlockUI: true,
          GlobalDialog: true,
          RouterView: true
        }
      }
    })

    await flushPromises()

    const event = new Event('vite:preloadError') as Event & {
      payload: Error
    }
    event.payload = new Error(
      'Extension named "Comfy.EasyUse.Widget" already registered.'
    )
    window.dispatchEvent(event)

    expect(consoleErrorSpy).toHaveBeenCalledWith('[vite:preloadError]', {
      url: null,
      fileType: 'unknown',
      chunkName: null,
      message: 'Extension named "Comfy.EasyUse.Widget" already registered.'
    })
    expect(mocks.toastAdd).not.toHaveBeenCalled()

    wrapper.unmount()
    consoleErrorSpy.mockRestore()
  })
})
