import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, reactive, ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { accountScope } from '../base/accountScope'
import { agentStorage } from '../base/agentStorage'
import { StorageKeys } from '../base/storageKeys'
import { useAccountStorage } from './useAccountStorage'

const identity = ref<{ id: string } | null>({ id: 'alice' })
const workspace = reactive({ activeWorkspaceId: 'team' })

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

let lifetime = effectScope()

beforeEach(() => {
  localStorage.clear()
  identity.value = { id: 'alice' }
  workspace.activeWorkspaceId = 'team'
  lifetime = effectScope()
  useCurrentUser().resolvedUserInfo = computed(() => identity.value)
  vi.spyOn(
    useTeamWorkspaceStore(),
    'activeWorkspaceId',
    'get'
  ).mockImplementation(() => workspace.activeWorkspaceId)
})

afterEach(() => lifetime.stop())

const accountKeys = [
  StorageKeys.agentThread,
  StorageKeys.agentWorkflowTabBindings,
  StorageKeys.agentChatTitles,
  StorageKeys.agentDeletedThreads,
  StorageKeys.agentOnboarded,
  StorageKeys.agentRunModePreference,
  StorageKeys.agentPanelDiscovered,
  StorageKeys.agentRunNoticeDismissed,
  StorageKeys.agentFreeUseNoticeDismissed,
  StorageKeys.agentCrdtNote
]

describe('account persistence', () => {
  it.for(accountKeys)(
    '%s isolates accounts in the same workspace',
    async (key) => {
      const state = lifetime.run(() => useAccountStorage(key, ''))!
      state.value = 'alice-only'
      identity.value = { id: 'bob' }
      expect(state.value).toBe('')
      state.value = 'bob-only'
      identity.value = { id: 'alice' }
      expect(state.value).toBe('alice-only')
      await nextTick()
      expect(state.value).toBe('alice-only')
    }
  )

  it('persists consecutive writes in the same tick', () => {
    const state = lifetime.run(() =>
      useAccountStorage(StorageKeys.agentChatTitles, {})
    )!
    state.value = { first: 'One' }
    state.value = { second: 'Two' }
    expect(
      localStorage.getItem(
        StorageKeys.agentChatTitles(accountScope('alice', 'team')!)
      )
    ).toBe('{"second":"Two"}')
  })

  it('isolates workspaces and does not persist unresolved identity edits', async () => {
    const state = lifetime.run(() =>
      useAccountStorage(StorageKeys.agentChatTitles, {})
    )!
    state.value = { thread: 'Alice' }
    workspace.activeWorkspaceId = 'another'
    await nextTick()
    expect(state.value).toEqual({})
    identity.value = null
    await nextTick()
    state.value = { thread: 'Unowned' }
    identity.value = { id: 'bob' }
    await nextTick()
    expect(state.value).toEqual({})
    expect(localStorage.getItem('')).toBeNull()
  })

  it.for([
    ['Comfy.AgentPanel.onboarded.alice.team', StorageKeys.agentOnboarded],
    [
      'Comfy.AgentPanel.freeUseNoticeDismissed.alice',
      StorageKeys.agentFreeUseNoticeDismissed
    ]
  ] as const)('renames owned legacy %s only on first read', ([legacy, key]) => {
    localStorage.setItem(legacy, 'true')
    const target = key(accountScope('alice', 'team')!)
    expect(agentStorage.getItem(target)).toBe('true')
    expect(localStorage.getItem(legacy)).toBeNull()
    agentStorage.setItem(target, 'false')
    expect(agentStorage.getItem(target)).toBe('false')
    expect(agentStorage.getItem(key(accountScope('bob', 'team')!))).toBeNull()
  })

  it.for(accountKeys)('%s refuses unowned legacy state', (key) => {
    localStorage.setItem(key('team'), 'previous-user')
    localStorage.setItem(key('team').split(':')[0], 'previous-user')
    expect(agentStorage.getItem(key(accountScope('alice', 'team')!))).toBeNull()
  })

  it('does not collide when identity fields contain separators', () => {
    expect(accountScope('a:b', 'c')).not.toBe(accountScope('a', 'b:c'))
  })
})
