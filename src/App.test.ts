import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  getStorageIdentity,
  getStorageScope,
  resetStorageAvailable,
  setStorageIdentity,
  setStorageWorkspaceId
} from '@/platform/workflow/persistence/base/storageIO'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import App from './App.vue'

vi.mock(import('firebase/auth'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true,
  isDesktop: false
}))

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

  it('owns storage identity before workflow persistence mounts', async () => {
    const resolvedUser = ref<{ id: string } | null>(null)
    useCurrentUser().resolvedUserInfo = computed(() => resolvedUser.value)
    setStorageIdentity(null)
    setStorageWorkspaceId(null)
    resetStorageAvailable()
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: null,
      initState: 'uninitialized'
    })

    const { unmount } = render(App, {
      global: { stubs: { RouterView: true } }
    })

    resolvedUser.value = { id: 'root-user' }
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'root-workspace',
      initState: 'ready'
    })
    await nextTick()

    expect(getStorageIdentity()).toBe('root-user')
    expect(getStorageScope()).toBe('root-user:root-workspace')
    unmount()
  })
})
