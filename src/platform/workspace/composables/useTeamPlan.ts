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

  const isTeamWorkspace = computed(() => !isInPersonalWorkspace.value)

  const isOnTeamPlan = computed(
    () => isTeamWorkspace.value && isWorkspaceSubscribed.value
  )
  const isCancelled = computed(() => subscription.value?.isCancelled ?? false)

  const isSubscriptionLapsed = computed(
    () =>
      subscriptionStatus.value === 'canceled' ||
      subscriptionStatus.value === 'ended'
  )
  const hasLapsedTeamPlan = computed(
    () => isTeamWorkspace.value && isSubscriptionLapsed.value
  )

  return { isOnTeamPlan, isCancelled, hasLapsedTeamPlan }
}
