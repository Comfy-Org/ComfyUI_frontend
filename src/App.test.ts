import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  reportPreloadError,
  reportPreloadErrorUnlessExtensionImport
} from '@/platform/telemetry/assetLoadErrorReporting'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import App from './App.vue'

vi.mock(import('firebase/auth'))

vi.mock<unknown>(import('@/components/dialog/GlobalDialog.vue'), () => ({
  default: { template: '<div />' }
}))
vi.mock<unknown>(import('@/scripts/app'), () => ({ app: {} }))
vi.mock(import('@/platform/telemetry/assetLoadErrorReporting'))
vi.mock<unknown>(import('@/composables/useAgentExtensionNotices'), () => ({
  useAgentExtensionNotices: vi.fn()
}))
vi.mock<unknown>(
  import('@/platform/customNodes/manager/composables/useConflictDetection'),
  () => ({
    useConflictDetection: () => ({
      initializeConflictDetection: vi.fn()
    })
  })
)

describe('App', () => {
  it('blocks existing dialogs while loading and keeps a stable readiness hook', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.spinner = true
    const { unmount } = render(App, {
      global: {
        stubs: { RouterView: true }
      }
    })
    await nextTick()

    const overlay = screen.getByTestId('app-loading-overlay')
    expect(overlay).toHaveAttribute('aria-busy', 'true')
    expect(overlay).toBeVisible()
    expect(overlay).toHaveClass('z-blocking')

    workspaceStore.spinner = false
    await nextTick()

    expect(screen.getByTestId('app-loading-overlay')).toBe(overlay)
    expect(overlay).toHaveAttribute('aria-busy', 'false')
    expect(overlay).not.toBeVisible()
    expect(overlay.style.zIndex).toBe('')

    workspaceStore.spinner = true
    await nextTick()

    expect(overlay).toBeVisible()
    expect(overlay).toHaveClass('z-blocking')
    unmount()
    expect(overlay.style.zIndex).toBe('')
  })

  function dispatchPreloadError(payload: Error) {
    const event = Object.assign(
      new Event('vite:preloadError', { cancelable: true }),
      { payload }
    )
    window.dispatchEvent(event)
    return event
  }

  it.for([
    "Unexpected token '}'",
    'Unexpected end of input',
    'Importing a module script failed.'
  ])(
    'lets a preload failure without a URL (%s) reject at its importer and reports it unless an extension import claims it',
    (message) => {
      const { unmount } = render(App, {
        global: { stubs: { RouterView: true } }
      })

      const payload = new SyntaxError(message)

      const event = dispatchPreloadError(payload)

      expect(event.defaultPrevented).toBe(false)
      expect(reportPreloadError).not.toHaveBeenCalled()
      expect(
        reportPreloadErrorUnlessExtensionImport
      ).toHaveBeenCalledExactlyOnceWith(payload)
      unmount()
    }
  )

  it('swallows and reports a first-party chunk preload failure', () => {
    const { unmount } = render(App, {
      global: { stubs: { RouterView: true } }
    })
    const payload = new Error(
      'Failed to fetch dynamically imported module: https://cloud.comfy.org/assets/GraphView-abc123.js'
    )

    const event = dispatchPreloadError(payload)

    expect(event.defaultPrevented).toBe(true)
    expect(reportPreloadError).toHaveBeenCalledExactlyOnceWith(payload)
    unmount()
  })
})
