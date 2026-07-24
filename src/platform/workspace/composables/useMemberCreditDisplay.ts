import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'

import { centsToCredits } from '@/base/credits/comfyCredits'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * The member-facing credit display rule (DES-504): a capped member's number
 * is min(limit − used, workspace balance); the info popover appears only when
 * the balance is the smaller term. Zero states outrank the rule —
 * workspace-out beats limit-reached.
 */
export function useMemberCreditDisplay() {
  const workspaceStore = useTeamWorkspaceStore()
  const { members, isInPersonalWorkspace } = storeToRefs(workspaceStore)
  const { userEmail } = useCurrentUser()
  const { balance } = useBillingContext()

  onMounted(() => {
    if (!isInPersonalWorkspace.value) void workspaceStore.ensureMembersLoaded()
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

  return {
    selfMember,
    memberCap,
    balanceCredits,
    displayedNumber,
    isWorkspaceOut,
    isLimitReached,
    isEdgeState,
    isTeamMemberViewer
  }
}
