import { effectScope, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  completeWorkflowLogoutTransition,
  prepareWorkflowLogoutTransition,
  prepareWorkflowWorkspaceTransition,
  setStorageIdentity,
  setStorageWorkspaceId
} from '../base/storageIO'
import { StorageKeys } from '../base/storageKeys'
import { unsafeStorageScope } from '../testUtils/storageScope'
import { useScopedLocalStorage } from './useScopedLocalStorage'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

function requireDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  if (value === undefined) throw new Error('Expected setup result to exist')
  return value
}

function parseStoredValue(key: string): unknown {
  const value = localStorage.getItem(key)
  expect(value).not.toBeNull()
  if (value === null) throw new Error(`Expected localStorage value for ${key}`)
  return JSON.parse(value)
}

describe('useScopedLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setStorageIdentity(null)
    setStorageWorkspaceId('workspace-1')
    sessionStorage.setItem(
      'Comfy.Workspace.Current',
      JSON.stringify({ type: 'team', id: 'workspace-1' })
    )
  })

  it('keeps unresolved state in memory without minting an ambiguous key', async () => {
    const scope = effectScope()
    const value = requireDefined(
      scope.run(() => useScopedLocalStorage(StorageKeys.agentChatTitles, {}))
    )

    value.value = { thread: 'Transient title' }
    await nextTick()

    expect(localStorage).toHaveLength(0)
    expect(value.value).toEqual({ thread: 'Transient title' })
    scope.stop()
  })

  it('isolates simultaneous unresolved refs from each other', async () => {
    const scope = effectScope()
    const values = requireDefined(
      scope.run(() => ({
        titles: useScopedLocalStorage(StorageKeys.agentChatTitles, {}),
        deletedIds: useScopedLocalStorage<string[]>(
          StorageKeys.agentDeletedThreads,
          []
        )
      }))
    )

    values.titles.value = { thread: 'Transient title' }
    await nextTick()

    expect(values.titles.value).toEqual({ thread: 'Transient title' })
    expect(values.deletedIds.value).toEqual([])
    expect(localStorage).toHaveLength(0)
    scope.stop()
  })

  it('loads the resolved identity scope when identity arrives', async () => {
    const resolvedScope = unsafeStorageScope('user-a:workspace-1')
    localStorage.setItem(
      StorageKeys.agentChatTitles(resolvedScope),
      JSON.stringify({ thread: 'Persisted title' })
    )
    const scope = effectScope()
    const value = requireDefined(
      scope.run(() => useScopedLocalStorage(StorageKeys.agentChatTitles, {}))
    )
    expect(value.value).toEqual({})

    setStorageIdentity('user-a')
    await nextTick()

    expect(value.value).toEqual({ thread: 'Persisted title' })
    value.value = { thread: 'Updated title' }
    await nextTick()
    expect(
      parseStoredValue(StorageKeys.agentChatTitles(resolvedScope))
    ).toEqual({
      thread: 'Updated title'
    })
    scope.stop()
  })

  it('detaches during a workspace transition and binds the destination scope', async () => {
    const firstScope = unsafeStorageScope('user-a:workspace-1')
    const secondScope = unsafeStorageScope('user-a:workspace-2')
    localStorage.setItem(
      StorageKeys.agentChatTitles(firstScope),
      JSON.stringify({ thread: 'First workspace' })
    )
    localStorage.setItem(
      StorageKeys.agentChatTitles(secondScope),
      JSON.stringify({ thread: 'Second workspace' })
    )
    setStorageIdentity('user-a')
    const effect = effectScope()
    const value = requireDefined(
      effect.run(() => useScopedLocalStorage(StorageKeys.agentChatTitles, {}))
    )
    expect(value.value).toEqual({ thread: 'First workspace' })

    const completeTransition = prepareWorkflowWorkspaceTransition()
    await nextTick()
    value.value = { thread: 'Transient during transition' }
    await nextTick()
    expect(parseStoredValue(StorageKeys.agentChatTitles(firstScope))).toEqual({
      thread: 'First workspace'
    })

    sessionStorage.setItem(
      'Comfy.Workspace.Current',
      JSON.stringify({ type: 'team', id: 'workspace-2' })
    )
    setStorageWorkspaceId('workspace-2')
    completeTransition()
    await nextTick()

    expect(value.value).toEqual({ thread: 'Second workspace' })
    effect.stop()
  })

  it('rebinds the same workspace to a new identity without overwriting the old identity', async () => {
    const firstScope = unsafeStorageScope('user-a:workspace-1')
    const secondScope = unsafeStorageScope('user-b:workspace-1')
    localStorage.setItem(
      StorageKeys.agentChatTitles(firstScope),
      JSON.stringify({ thread: 'User A title' })
    )
    localStorage.setItem(
      StorageKeys.agentChatTitles(secondScope),
      JSON.stringify({ thread: 'User B title' })
    )
    setStorageIdentity('user-a')
    const scope = effectScope()
    const value = requireDefined(
      scope.run(() => useScopedLocalStorage(StorageKeys.agentChatTitles, {}))
    )
    expect(value.value).toEqual({ thread: 'User A title' })

    prepareWorkflowLogoutTransition()
    setStorageIdentity('user-b')
    await nextTick()
    expect(parseStoredValue(StorageKeys.agentChatTitles(firstScope))).toEqual({
      thread: 'User A title'
    })
    completeWorkflowLogoutTransition()
    await nextTick()

    expect(value.value).toEqual({ thread: 'User B title' })
    value.value = { thread: 'Updated user B title' }
    await nextTick()
    expect(parseStoredValue(StorageKeys.agentChatTitles(firstScope))).toEqual({
      thread: 'User A title'
    })
    expect(parseStoredValue(StorageKeys.agentChatTitles(secondScope))).toEqual({
      thread: 'Updated user B title'
    })
    scope.stop()
  })
})
