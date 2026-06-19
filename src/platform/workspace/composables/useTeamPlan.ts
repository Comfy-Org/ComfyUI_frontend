import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * Team-plan state for the active workspace. The team plan is tier-independent
 * (no standard/creator/pro): "on the team plan" simply means a team workspace
 * that is subscribed to it.
 */
export function useTeamPlan() {
  const { subscription, subscriptionStatus } = useBillingContext()
  const { isInPersonalWorkspace, isWorkspaceSubscribed } = storeToRefs(
    useTeamWorkspaceStore()
  )

  const isOnTeamPlan = computed(
    () => !isInPersonalWorkspace.value && isWorkspaceSubscribed.value
  )
  const isCancelled = computed(() => subscription.value?.isCancelled ?? false)

  // Subscribed-then-lapsed (cancelled or ended), not never-subscribed — drives
  // reactivate-vs-upgrade copy.
  const hasLapsedTeamPlan = computed(
    () =>
      !isInPersonalWorkspace.value &&
      (subscriptionStatus.value === 'canceled' ||
        subscriptionStatus.value === 'ended')
  )

  return { isOnTeamPlan, isCancelled, hasLapsedTeamPlan }
}
