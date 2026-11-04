import type {
  SubscriptionTier,
  WorkspaceWithRole
} from '@comfyorg/ingest-types'
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'

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
    }

    watch(() => workspace.identityGeneration, reset, { flush: 'sync' })

    return {
      getSummary,
      activeSummary,
      isWorkspaceSubscribed,
      updateSummary
    }
  }
)
