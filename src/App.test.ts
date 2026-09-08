import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import App from './App.vue'

vi.mock('@/components/dialog/GlobalDialog.vue', () => ({
  default: { template: '<div />' }
}))
vi.mock('@/platform/distribution/types', () => ({ isDesktop: false }))
vi.mock('@/scripts/app', () => ({ app: {} }))
vi.mock('@/stores/workspaceStore', async () => {
  const { reactive } = await import('vue')
  const store = reactive({ spinner: true })
  return { useWorkspaceStore: () => store }
})
vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => ({
      initializeConflictDetection: vi.fn()
    })
  })
)

describe('App', () => {
  it('blocks existing dialogs while loading and keeps a stable readiness hook', async () => {
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

    const workspaceStore = useWorkspaceStore()
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
