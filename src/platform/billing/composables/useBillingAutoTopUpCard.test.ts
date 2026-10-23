import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import { useBillingAutoTopUpCard } from './useBillingAutoTopUpCard'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'))

async function switchBillingScope(actorId: string, workspaceId: string) {
  stubFirebaseAuthHarness()
  const auth = useAuthStore()
  auth.currentUser = fromPartial<User>({ uid: actorId })
  expect(auth.userId).toBe(actorId)

  const store = useTeamWorkspaceStore()
  if (store.activeWorkspaceId === workspaceId) return
  if (!store.workspaces.some((workspace) => workspace.id === workspaceId)) {
    store.workspaces = [
      ...store.workspaces,
      {
        id: workspaceId,
        name: workspaceId,
        type: 'personal',
        role: 'owner'
      } as (typeof store.workspaces)[number]
    ]
  }
  const generation = store.workspaceTransitionGeneration
  const workspaceAuth = useWorkspaceAuthStore()
  vi.spyOn(workspaceAuth, 'switchWorkspace').mockImplementation(async () => {
    workspaceAuth.currentWorkspace = {
      id: workspaceId,
      name: workspaceId,
      type: 'personal',
      role: 'owner'
    }
  })
  await store.switchWorkspace(workspaceId)
  expect(store.activeWorkspaceId).toBe(workspaceId)
  expect(store.workspaceTransitionGeneration).toBe(generation + 1)
}

function settingsWith(
  status: AutoReloadSettings['status']
): AutoReloadSettings {
  return {
    configured: status !== 'off',
    cycle_resets_at: '2026-11-28T00:00:00Z',
    disabled_reason: null,
    enabled: status === 'on' || status === 'failed',
    last_failure_at: null,
    last_failure_reason: null,
    max_monthly_budget_cents: 100000,
    min_reload_credits: 1000,
    monthly_budget_cents: 20000,
    paused_by_budget: false,
    paused_by_decline: false,
    reload_amount_cents: 2500,
    reload_credits: 5275,
    spent_this_cycle_cents: 0,
    status,
    threshold_credits: 1000
  }
}

function heldReads() {
  const held: Array<(settings: AutoReloadSettings) => void> = []
  vi.mocked(workspaceApi.getBillingAutoReload).mockImplementation(
    () =>
      new Promise<AutoReloadSettings>((resolve) => {
        held.push(resolve)
      })
  )
  return {
    async answer(index: number, status: AutoReloadSettings['status']) {
      held[index](settingsWith(status))
      await vi.waitFor(() => expect(held.length).toBeGreaterThan(index))
      await nextTick()
      await Promise.resolve()
    },
    count: () => held.length
  }
}

describe('useBillingAutoTopUpCard across a workspace switch', () => {
  let scope: EffectScope

  afterEach(() => scope.stop())

  function mountRead() {
    scope = effectScope()
    return scope.run(() => useBillingAutoTopUpCard())!
  }

  it('does not show workspace A settings in workspace B while B is reading', async () => {
    const reads = heldReads()
    await switchBillingScope('actor-a', 'workspace-a')
    const card = mountRead()
    card.ensureRead()
    await reads.answer(0, 'failed')
    expect(card.state.value).toMatchObject({
      kind: 'loaded',
      settings: { status: 'failed' }
    })

    await switchBillingScope('actor-a', 'workspace-b')
    await nextTick()

    expect(reads.count()).toBe(2)
    expect(card.state.value.kind).not.toBe('loaded')
    expect(card.isReady.value).toBe(false)

    await reads.answer(1, 'on')
    expect(card.state.value).toMatchObject({
      kind: 'loaded',
      settings: { status: 'on' }
    })
  })

  it('ignores a late workspace A answer after switching to workspace B', async () => {
    const reads = heldReads()
    await switchBillingScope('actor-a', 'workspace-a')
    const card = mountRead()
    card.ensureRead()
    await switchBillingScope('actor-a', 'workspace-b')
    await nextTick()

    await reads.answer(0, 'failed')
    expect(card.state.value.kind).not.toBe('loaded')

    await reads.answer(1, 'on')
    expect(card.state.value).toMatchObject({
      kind: 'loaded',
      settings: { status: 'on' }
    })
  })

  it('does not show one actor settings to the next actor in the same workspace', async () => {
    const reads = heldReads()
    await switchBillingScope('actor-a', 'workspace-a')
    const card = mountRead()
    card.ensureRead()
    await reads.answer(0, 'failed')

    await switchBillingScope('actor-b', 'workspace-a')
    await nextTick()

    expect(card.state.value.kind).not.toBe('loaded')

    await reads.answer(1, 'on')
  })

  it('shows loading while a failed read is retried', async () => {
    await switchBillingScope('actor-a', 'workspace-a')
    vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValueOnce(
      new Error('auto reload down')
    )
    const card = mountRead()
    card.ensureRead()
    await vi.waitFor(() => expect(card.state.value.kind).toBe('unavailable'))

    const retried = heldReads()
    const retry = card.retry()
    await vi.waitFor(() => expect(card.state.value.kind).toBe('loading'))

    await retried.answer(0, 'on')
    await retry
  })

  it('starts no second read for workspace B when workspace A finishes while B is reading', async () => {
    const reads = heldReads()
    await switchBillingScope('actor-a', 'workspace-a')
    const card = mountRead()
    card.ensureRead()
    await switchBillingScope('actor-a', 'workspace-b')
    await nextTick()
    expect(reads.count()).toBe(2)

    await reads.answer(0, 'failed')
    card.ensureRead()

    expect(reads.count()).toBe(2)

    await reads.answer(1, 'on')
  })

  it('keeps the last settings when a refresh of the same workspace fails', async () => {
    await switchBillingScope('actor-a', 'workspace-a')
    vi.mocked(workspaceApi.getBillingAutoReload).mockResolvedValueOnce(
      settingsWith('failed')
    )
    const card = mountRead()
    card.ensureRead()
    await vi.waitFor(() => expect(card.state.value.kind).toBe('loaded'))

    vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValueOnce(
      new Error('auto reload down')
    )
    await card.retry()

    expect(card.state.value).toMatchObject({
      kind: 'loaded',
      settings: { status: 'failed' }
    })
  })
})
