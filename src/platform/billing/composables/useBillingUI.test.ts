import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, effectScope } from 'vue'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'

const distribution = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingRouting'))
vi.mock(import('@/platform/workspace/ports/workspaceIdentity'))

describe('billing UI entry capabilities', () => {
  it.for([
    {
      name: 'workspace reactivation grant without management permission',
      cloud: true,
      workspaceBilling: true,
      authoritative: true,
      canManage: false,
      canReactivate: true,
      canSubscribe: false,
      expected: { reactivate: true, pricing: false }
    },
    {
      name: 'workspace pricing grant without management permission',
      cloud: true,
      workspaceBilling: true,
      authoritative: true,
      canManage: false,
      canReactivate: false,
      canSubscribe: true,
      expected: { reactivate: false, pricing: true }
    },
    {
      name: 'workspace denials despite management permission',
      cloud: true,
      workspaceBilling: true,
      authoritative: true,
      canManage: true,
      canReactivate: false,
      canSubscribe: false,
      expected: { reactivate: false, pricing: false }
    },
    {
      name: 'legacy management fallback despite capability denials',
      cloud: true,
      workspaceBilling: false,
      authoritative: true,
      canManage: true,
      canReactivate: false,
      canSubscribe: false,
      expected: { reactivate: true, pricing: true }
    },
    {
      name: 'non-Cloud management fallback despite capability grants',
      cloud: false,
      workspaceBilling: true,
      authoritative: true,
      canManage: false,
      canReactivate: true,
      canSubscribe: true,
      expected: { reactivate: false, pricing: false }
    },
    {
      name: 'pending snapshot uses pricing fallback but not reactivation fallback',
      cloud: true,
      workspaceBilling: true,
      authoritative: false,
      canManage: false,
      canReactivate: true,
      canSubscribe: true,
      expected: { reactivate: true, pricing: false }
    },
    {
      name: 'pending snapshot retains the management pricing grant',
      cloud: true,
      workspaceBilling: true,
      authoritative: false,
      canManage: true,
      canReactivate: false,
      canSubscribe: false,
      expected: { reactivate: false, pricing: true }
    }
  ])(
    '$name',
    ({
      cloud,
      workspaceBilling,
      authoritative,
      canManage,
      canReactivate,
      canSubscribe,
      expected
    }) => {
      distribution.isCloud = cloud
      vi.mocked(useWorkspaceIdentity).mockReturnValue({
        workspaces: [],
        activeWorkspace: {
          id: 'workspace-1',
          name: 'Team',
          type: 'team',
          role: 'member'
        },
        activeWorkspaceId: 'workspace-1',
        isInPersonalWorkspace: false,
        workspaceTransitionGeneration: 0,
        identityGeneration: 0
      })
      vi.mocked(useBillingRouting)().shouldUseWorkspaceBilling = computed(
        () => workspaceBilling
      )
      const capabilities = vi.mocked(useBillingCapabilities)()
      capabilities.snapshotAuthoritative = computed(() => authoritative)
      capabilities.canManageSubscription = computed(() =>
        receiveServerFact('can_manage_subscription', canManage)
      )
      capabilities.canReactivate = computed(() => canReactivate)
      capabilities.canSubscribeSelfServe = computed(() => canSubscribe)
      const scope = effectScope()
      onTestFinished(() => scope.stop())

      const ui = scope.run(useBillingUI)

      expect({
        reactivate: ui?.canReactivatePlan.value,
        pricing: ui?.canOpenPricingSurface.value
      }).toEqual(expected)
    }
  )
})
