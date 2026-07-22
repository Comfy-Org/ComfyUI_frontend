import { captureException } from '@sentry/vue'
import { render } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App.vue'

vi.mock('@sentry/vue', () => ({ captureException: vi.fn() }))

vi.mock('@/components/dialog/GlobalDialog.vue', () => ({
  default: { name: 'GlobalDialog', template: '<div />' }
}))

vi.mock('@/config', () => ({ default: { app_version: 'test-version' } }))

vi.mock('@/scripts/app', () => ({ app: {} }))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ spinner: false })
}))

vi.mock('@/utils/envUtil', () => ({ electronAPI: () => null }))

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => ({
      initializeConflictDetection: vi.fn().mockResolvedValue(undefined)
    })
  })
)

function mountApp() {
  return render(App, {
    global: { stubs: { RouterView: true, BlockUI: true } }
  })
}

function dispatchPreloadError(error: Error): Event {
  const event = new Event('vite:preloadError', { cancelable: true })
  Object.defineProperty(event, 'payload', { value: error })
  window.dispatchEvent(event)
  return event
}

describe('App vite:preloadError handling', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('logs extension-origin failures as warnings and skips Sentry', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const { unmount } = mountApp()
    try {
      const event = dispatchPreloadError(
        new Error(
          'Failed to fetch dynamically imported module: https://example.com/extensions/SomePack/widgets.js'
        )
      )

      expect(event.defaultPrevented).toBe(true)
      expect(warnSpy).toHaveBeenCalledWith(
        '[vite:preloadError]',
        expect.objectContaining({
          url: 'https://example.com/extensions/SomePack/widgets.js'
        })
      )
      expect(errorSpy).not.toHaveBeenCalledWith(
        '[vite:preloadError]',
        expect.anything()
      )
      expect(captureException).not.toHaveBeenCalled()
    } finally {
      unmount()
    }
  })

  it('logs first-party chunk failures as errors and reports to Sentry on cloud', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const { unmount } = mountApp()
    try {
      const error = new Error(
        'Failed to fetch dynamically imported module: https://example.com/assets/vendor-three-def456.js'
      )
      const event = dispatchPreloadError(error)

      expect(event.defaultPrevented).toBe(true)
      expect(errorSpy).toHaveBeenCalledWith(
        '[vite:preloadError]',
        expect.objectContaining({
          url: 'https://example.com/assets/vendor-three-def456.js'
        })
      )
      expect(warnSpy).not.toHaveBeenCalledWith(
        '[vite:preloadError]',
        expect.anything()
      )
      expect(captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({ error_type: 'vite_preload_error' })
        })
      )
    } finally {
      unmount()
    }
  })
})
