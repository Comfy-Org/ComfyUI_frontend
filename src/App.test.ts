import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import App from './App.vue'

vi.mock('firebase/auth')
vi.mock('vuefire', () => ({ useFirebaseAuth: vi.fn() }))

vi.mock('@/components/dialog/GlobalDialog.vue', () => ({
  default: { template: '<div />' }
}))
vi.mock('@/scripts/app', () => ({ app: {} }))
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
