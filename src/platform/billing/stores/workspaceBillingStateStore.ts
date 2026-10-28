import type {
  BillingStatusResponse,
  SubscriptionTier,
  WorkspaceWithRole
} from '@comfyorg/ingest-types'
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'

type BillingRail = NonNullable<BillingStatusResponse['billing_rail']>

interface WorkspaceBillingSummary {
  isSubscribed: boolean
  subscriptionPlan: string | null
  subscriptionTier: SubscriptionTier | null
}

export const useWorkspaceBillingStateStore = defineStore(
  'workspaceBillingState',
  () => {
    const workspace = useWorkspaceIdentity()
    const summaries = shallowRef<
      Readonly<Record<string, Partial<WorkspaceBillingSummary>>>
    >({})
    const rails = shallowRef<Readonly<Record<string, BillingRail>>>({})

    const activeWorkspaceBillingRail = computed(() => {
      const id = workspace.activeWorkspaceId
      return id ? (rails.value[id] ?? null) : null
    })

    function getSummary(
      workspace: Pick<WorkspaceWithRole, 'id' | 'type' | 'subscription_tier'>
    ): WorkspaceBillingSummary {
      return {
        isSubscribed:
          workspace.type === 'personal' || !!workspace.subscription_tier,
        subscriptionPlan: null,
        subscriptionTier: workspace.subscription_tier ?? null,
        ...summaries.value[workspace.id]
      }
    }

    const activeSummary = computed(() =>
      workspace.activeWorkspace ? getSummary(workspace.activeWorkspace) : null
    )
    const isWorkspaceSubscribed = computed(
      () => activeSummary.value?.isSubscribed ?? false
    )

    function setWorkspaceBillingRail(id: string, rail: BillingRail): void {
      rails.value = { ...rails.value, [id]: rail }
    }

    function updateSummary(
      id: string,
      summary: Partial<WorkspaceBillingSummary>
    ): void {
      summaries.value = {
        ...summaries.value,
        [id]: { ...summaries.value[id], ...summary }
      }
    }

    function reset(): void {
      summaries.value = {}
      rails.value = {}
    }

    watch(() => workspace.identityGeneration, reset, { flush: 'sync' })

    return {
      getSummary,
      activeSummary,
      isWorkspaceSubscribed,
      activeWorkspaceBillingRail,
      setWorkspaceBillingRail,
      updateSummary
    }
  }
)
