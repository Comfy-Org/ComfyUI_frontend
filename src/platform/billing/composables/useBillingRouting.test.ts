import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import type { BillingRail } from '@comfyorg/billing-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { fromPartial } from '@total-typescript/shoehorn'

import { useBillingRouting } from './useBillingRouting'

const mockIsCloud = vi.hoisted(() => ({ value: true }))

let mockActiveWorkspace: Ref<
  ReturnType<typeof useTeamWorkspaceStore>['activeWorkspace']
>

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const personal = fromPartial<
  NonNullable<ReturnType<typeof useTeamWorkspaceStore>['activeWorkspace']>
>({ id: 'w-personal', type: 'personal' })
const team = fromPartial<
  NonNullable<ReturnType<typeof useTeamWorkspaceStore>['activeWorkspace']>
>({ id: 'w-team', type: 'team' })

describe('useBillingRouting', () => {
  beforeEach(() => {
    const refs = storeToRefs(useTeamWorkspaceStore())
    mockActiveWorkspace = refs.activeWorkspace
    mockIsCloud.value = true
    mockActiveWorkspace.value = personal
  })

  it('is unknown off Cloud until a workspace context loads', () => {
    mockIsCloud.value = false
    mockActiveWorkspace.value = null

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('unknown')
    expect(shouldUseWorkspaceBilling.value).toBe(false)
  })

  it('uses workspace billing off Cloud once a workspace context loads', () => {
    mockIsCloud.value = false
    mockActiveWorkspace.value = team

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for a Cloud personal workspace', () => {
    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it.for<BillingRail | null>(['legacy_stripe', 'stripe', 'metronome', null])(
    'uses workspace billing for a Cloud personal workspace whatever its served rail (%s)',
    (rail) => {
      const servedRail: Ref<BillingRail | null> = storeToRefs(
        useWorkspaceBillingStateStore()
      ).activeWorkspaceBillingRail
      servedRail.value = rail

      const { type, shouldUseWorkspaceBilling } = useBillingRouting()

      expect(type.value).toBe('workspace')
      expect(shouldUseWorkspaceBilling.value).toBe(true)
    }
  )

  it('uses unified pricing for a Cloud personal workspace', () => {
    const { shouldUseUnifiedPricing } = useBillingRouting()

    expect(shouldUseUnifiedPricing.value).toBe(true)
  })

  it('uses workspace billing for team workspaces', () => {
    mockActiveWorkspace.value = team

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('is unknown while the workspace has not loaded, then resolves', () => {
    mockActiveWorkspace.value = null

    const { type } = useBillingRouting()
    expect(type.value).toBe('unknown')

    mockActiveWorkspace.value = personal
    expect(type.value).toBe('workspace')

    mockActiveWorkspace.value = null
    expect(type.value).toBe('unknown')

    mockActiveWorkspace.value = team
    expect(type.value).toBe('workspace')
  })
})
