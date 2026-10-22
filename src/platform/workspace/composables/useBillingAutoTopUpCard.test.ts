import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { activateBillingScope } from '@/platform/workspace/composables/activateBillingScope.testUtils'

import { useBillingAutoTopUpCard } from './useBillingAutoTopUpCard'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'))

function settingsWith(status: AutoReloadSettings['status']) {
  const settings: Partial<AutoReloadSettings> = { status }
  return settings as AutoReloadSettings
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
    activateBillingScope('actor-a', 'workspace-a')
    const card = mountRead()
    card.ensureRead()
    await reads.answer(0, 'failed')
    expect(card.state.value).toMatchObject({
      kind: 'loaded',
      settings: { status: 'failed' }
    })

    activateBillingScope('actor-a', 'workspace-b')
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
    activateBillingScope('actor-a', 'workspace-a')
    const card = mountRead()
    card.ensureRead()
    activateBillingScope('actor-a', 'workspace-b')
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
    activateBillingScope('actor-a', 'workspace-a')
    const card = mountRead()
    card.ensureRead()
    await reads.answer(0, 'failed')

    activateBillingScope('actor-b', 'workspace-a')
    await nextTick()

    expect(card.state.value.kind).not.toBe('loaded')
  })
})
