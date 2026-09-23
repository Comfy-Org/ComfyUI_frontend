import { fromPartial } from '@total-typescript/shoehorn'
import { storeToRefs } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { BillingRail } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useBillingRouting } from './useBillingRouting'

const mockIsCloud = vi.hoisted(() => ({ value: true }))

let mockActiveWorkspace: Ref<
  ReturnType<typeof useTeamWorkspaceStore>['activeWorkspace']
>
let mockActiveWorkspaceBillingRail: Ref<BillingRail | null>

vi.mock(import('@/composables/useFeatureFlags'))
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
    mockActiveWorkspaceBillingRail = refs.activeWorkspaceBillingRail
    mockIsCloud.value = true
    mockActiveWorkspace.value = personal
    mockActiveWorkspaceBillingRail.value = null
  })

  it('uses legacy billing off Cloud until a workspace context loads', () => {
    mockIsCloud.value = false
    mockActiveWorkspace.value = null

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('legacy')
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

  it('uses unified pricing while keeping legacy Stripe top-ups on Checkout', () => {
    mockActiveWorkspaceBillingRail.value = 'legacy_stripe'

    const { type, shouldUseWorkspaceBilling, shouldUseUnifiedPricing } =
      useBillingRouting()

    expect(type.value).toBe('legacy')
    expect(shouldUseWorkspaceBilling.value).toBe(false)
    expect(shouldUseUnifiedPricing.value).toBe(true)
  })

  it('migrates legacy Stripe personal workspaces behind the rollout flag', () => {
    vi.mocked(useFeatureFlags().flags).legacyBillingMigrationEnabled = true
    mockActiveWorkspaceBillingRail.value = 'legacy_stripe'

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for migrated Stripe personal workspaces', () => {
    mockActiveWorkspace.value = personal
    mockActiveWorkspaceBillingRail.value = 'stripe'

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('uses workspace billing for team workspaces', () => {
    mockActiveWorkspace.value = team
    mockActiveWorkspaceBillingRail.value = 'legacy_stripe'

    const { type, shouldUseWorkspaceBilling } = useBillingRouting()

    expect(type.value).toBe('workspace')
    expect(shouldUseWorkspaceBilling.value).toBe(true)
  })

  it('defaults to legacy while the workspace has not loaded', () => {
    mockActiveWorkspace.value = null

    const { type } = useBillingRouting()

    expect(type.value).toBe('legacy')
  })
})
