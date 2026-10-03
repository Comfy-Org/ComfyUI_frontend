import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import { reportPreloadError } from '@/platform/telemetry/assetLoadErrorReporting'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import App from './App.vue'

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/telemetry/assetLoadErrorReporting'))

vi.mock<unknown>(import('@/components/dialog/GlobalDialog.vue'), () => ({
  default: { template: '<div />' }
}))
vi.mock<unknown>(import('@/scripts/app'), () => ({ app: {} }))
vi.mock<unknown>(
  import('@/workbench/extensions/manager/composables/useConflictDetection'),
  () => ({
    useConflictDetection: () => ({
      initializeConflictDetection: vi.fn()
    })
  })
)

describe('App', () => {
  it('reports preload failures without suppressing the import rejection', () => {
    const { unmount } = render(App, {
      global: { stubs: { RouterView: true } }
    })
    const error = new SyntaxError("Unexpected token '}'")
    const event = Object.assign(
      new Event('vite:preloadError', { cancelable: true }),
      {
        payload: error
      }
    )

    window.dispatchEvent(event)

    expect(reportPreloadError).toHaveBeenCalledWith(error)
    expect(event.defaultPrevented).toBe(false)
    unmount()
  })

  it('keeps CSS preload failures from blocking module execution', () => {
    const { unmount } = render(App, {
      global: { stubs: { RouterView: true } }
    })
    const error = new Error('Unable to preload CSS for /assets/graph.css')
    const event = Object.assign(
      new Event('vite:preloadError', { cancelable: true }),
      { payload: error }
    )

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(reportPreloadError).toHaveBeenCalledWith(error)
    unmount()
  })

  it('preserves rejection when an evaluation error merely mentions a stylesheet', () => {
    const { unmount } = render(App, {
      global: { stubs: { RouterView: true } }
    })
    const error = new Error(
      'Module failed while using https://example.com/app.css'
    )
    const event = Object.assign(
      new Event('vite:preloadError', { cancelable: true }),
      { payload: error }
    )

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(reportPreloadError).toHaveBeenCalledWith(error)
    unmount()
  })

  it('blocks existing dialogs while loading and keeps a stable readiness hook', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.spinner = true
    render({
      directives: { rekaZIndex: vRekaZIndex },
      template: '<div v-reka-z-index data-testid="dialog" />'
    })
    const dialog = screen.getByTestId('dialog')
    const { unmount } = render(App, {
      global: {
        stubs: { RouterView: true }
      }
    })
    await nextTick()

    const overlay = screen.getByTestId('app-loading-overlay')
    expect(overlay).toHaveAttribute('aria-busy', 'true')
    expect(overlay).toBeVisible()
    expect(ZIndex.get(overlay)).toBeGreaterThan(ZIndex.get(dialog))

    workspaceStore.spinner = false
    await nextTick()

    expect(screen.getByTestId('app-loading-overlay')).toBe(overlay)
    expect(overlay).toHaveAttribute('aria-busy', 'false')
    expect(overlay).not.toBeVisible()
    expect(ZIndex.get(overlay)).toBe(0)

    workspaceStore.spinner = true
    await nextTick()

    expect(overlay).toBeVisible()
    expect(ZIndex.get(overlay)).toBeGreaterThan(ZIndex.get(dialog))
    unmount()
    expect(ZIndex.get(overlay)).toBe(0)
  })
})
