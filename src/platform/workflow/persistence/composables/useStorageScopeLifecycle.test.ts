import { computed, effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import {
  getStorageIdentity,
  getStorageScope,
  getStorageWriteGate,
  resetStorageAvailable,
  setStorageIdentity,
  setStorageWorkspaceId
} from '../base/storageIO'
import { useStorageScopeLifecycle } from './useStorageScopeLifecycle'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

describe('useStorageScopeLifecycle', () => {
  const resolvedUser = ref<{ id: string } | null>(null)

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resolvedUser.value = null
    useCurrentUser().resolvedUserInfo = computed(() => resolvedUser.value)
    setStorageIdentity(null)
    setStorageWorkspaceId(null)
    resetStorageAvailable()
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: null,
      initState: 'uninitialized'
    })
  })

  it('owns identity and opens scoped storage after workspace ownership resolves', async () => {
    const scope = effectScope()
    scope.run(useStorageScopeLifecycle)

    resolvedUser.value = { id: 'user-a' }
    expect(getStorageIdentity()).toBe('user-a')
    expect(getStorageWriteGate()).toBe('deferred')

    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
      JSON.stringify({ type: 'team', id: 'workspace-a' })
    )
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-a',
      initState: 'ready'
    })
    await nextTick()

    expect(getStorageScope()).toBe('user-a:workspace-a')
    expect(getStorageWriteGate()).toBe('open')
    scope.stop()
  })

  it('updates identity even when GraphCanvas persistence is never mounted', async () => {
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-a',
      initState: 'ready'
    })
    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
      JSON.stringify({ type: 'team', id: 'workspace-a' })
    )
    const scope = effectScope()
    scope.run(useStorageScopeLifecycle)

    resolvedUser.value = { id: 'user-a' }
    await nextTick()

    expect(getStorageIdentity()).toBe('user-a')
    expect(getStorageScope()).toBe('user-a:workspace-a')
    scope.stop()
  })

  it('uses the API-key workspace that became ready instead of a stale session record', async () => {
    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
      JSON.stringify({ type: 'team', id: 'stale-firebase-workspace' })
    )
    const scope = effectScope()
    scope.run(useStorageScopeLifecycle)

    resolvedUser.value = { id: 'api-key-user' }
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'api-key-bound-workspace',
      initState: 'ready'
    })
    await nextTick()

    expect(getStorageScope()).toBe('api-key-user:api-key-bound-workspace')
    expect(getStorageWriteGate()).toBe('open')
    scope.stop()
  })

  it('uses the API-key workspace that became ready without a session record', async () => {
    const scope = effectScope()
    scope.run(useStorageScopeLifecycle)

    resolvedUser.value = { id: 'api-key-user' }
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'api-key-bound-workspace',
      initState: 'ready'
    })
    await nextTick()

    expect(
      sessionStorage.getItem(WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE)
    ).toBeNull()
    expect(getStorageScope()).toBe('api-key-user:api-key-bound-workspace')
    expect(getStorageWriteGate()).toBe('open')
    scope.stop()
  })

  it('resets a ready API-key workspace before opening storage for a replacement key', async () => {
    const teamWorkspaceStore = useTeamWorkspaceStore()
    const resetSpy = vi.spyOn(teamWorkspaceStore, 'resetForIdentityChange')
    const initializeSpy = vi
      .spyOn(teamWorkspaceStore, 'initialize')
      .mockResolvedValue()
    const scope = effectScope()
    scope.run(useStorageScopeLifecycle)

    resolvedUser.value = { id: 'api-key-user-a' }
    Object.assign(teamWorkspaceStore, {
      activeWorkspaceId: 'workspace-a',
      initState: 'ready'
    })
    await nextTick()
    expect(getStorageScope()).toBe('api-key-user-a:workspace-a')

    resolvedUser.value = { id: 'api-key-user-b' }

    expect(resetSpy).toHaveBeenCalledOnce()
    expect(initializeSpy).toHaveBeenCalledOnce()
    expect(teamWorkspaceStore.initState).toBe('uninitialized')
    expect(getStorageScope()).toBeNull()
    expect(getStorageWriteGate()).toBe('deferred')

    Object.assign(teamWorkspaceStore, {
      activeWorkspaceId: 'workspace-b',
      initState: 'ready'
    })
    await nextTick()

    expect(getStorageScope()).toBe('api-key-user-b:workspace-b')
    expect(getStorageWriteGate()).toBe('open')
    scope.stop()
  })
})
