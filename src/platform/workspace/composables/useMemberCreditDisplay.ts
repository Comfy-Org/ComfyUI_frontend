import { storeToRefs } from 'pinia'
import { computed, watchEffect } from 'vue'

import { centsToCredits } from '@/base/credits/comfyCredits'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/** Placeholder until balance-at-top-up is instrumented (DES-504). */
const REQUEST_BUTTON_FLOOR = 1500

/**
 * The member-facing credit display rule (DES-504): a capped member's number
 * is min(limit − used, workspace balance); the info popover appears only when
 * the balance is the smaller term. Zero states outrank the rule —
 * workspace-out beats limit-reached. The number never changes colour, and
 * both member surfaces derive their request button from `requestAction`.
 */
export function useMemberCreditDisplay() {
  const workspaceStore = useTeamWorkspaceStore()
  const { members, activeWorkspaceId, isInPersonalWorkspace } =
    storeToRefs(workspaceStore)
  const { userEmail } = useCurrentUser()
  const { balance } = useBillingContext()

  watchEffect(() => {
    if (activeWorkspaceId.value && !isInPersonalWorkspace.value)
      void workspaceStore.ensureMembersLoaded()
  })

  const selfMember = computed(() =>
    members.value.find(
      (m) => m.email.toLowerCase() === userEmail.value?.toLowerCase()
    )
  )

  const memberCap = computed(() => {
    const m = selfMember.value
    if (isInPersonalWorkspace.value || !m || m.role !== 'member') return null
    if (m.monthlyCreditLimit == null) return null
    return {
      limit: m.monthlyCreditLimit,
      used: m.creditsUsedThisMonth ?? 0,
      remaining: Math.max(
        0,
        m.monthlyCreditLimit - (m.creditsUsedThisMonth ?? 0)
      )
    }
  })

  const balanceCredits = computed(() =>
    centsToCredits(
      balance.value?.effectiveBalanceMicros ?? balance.value?.amountMicros ?? 0
    )
  )

  const displayedNumber = computed(() =>
    memberCap.value
      ? Math.min(memberCap.value.remaining, balanceCredits.value)
      : balanceCredits.value
  )

  const isWorkspaceOut = computed(() => balanceCredits.value <= 0)
  const isLimitReached = computed(
    () =>
      memberCap.value !== null &&
      memberCap.value.remaining <= 0 &&
      !isWorkspaceOut.value
  )
  const isEdgeState = computed(
    () =>
      memberCap.value !== null &&
      !isWorkspaceOut.value &&
      !isLimitReached.value &&
      balanceCredits.value < memberCap.value.remaining
  )

  const isTeamMemberViewer = computed(
    () => !isInPersonalWorkspace.value && selfMember.value?.role === 'member'
  )

  const requestAction = computed(() => {
    if (!isTeamMemberViewer.value) return null
    if (isWorkspaceOut.value) return 'notifyOwner' as const
    // Edge state shows no button — the popover alone explains the substituted
    // number, and a limit increase wouldn't help while the pool binds.
    if (isEdgeState.value) return null
    // Uncapped members have exactly two states, healthy and workspace-out
    // (2026-07-27): with no cap there is nothing workspace-specific to ask for
    // short of the pool running dry, which the zero state already covers.
    if (!memberCap.value) return null
    if (displayedNumber.value > REQUEST_BUTTON_FLOOR) return null
    return 'requestLimitIncrease' as const
  })

  return {
    selfMember,
    memberCap,
    balanceCredits,
    displayedNumber,
    isWorkspaceOut,
    isLimitReached,
    isEdgeState,
    isTeamMemberViewer,
    requestAction
  }
}
