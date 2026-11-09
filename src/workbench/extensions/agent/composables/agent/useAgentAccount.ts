import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useAccountUI } from '@/platform/account/composables/useAccountUI'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkspaceTierLabel } from '@/platform/billing/composables/useWorkspaceTierLabel'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { getUserInitials } from '@/utils/userInitials'

export function useAgentAccount() {
  const { locale } = useI18n()
  const { userDisplayName, userEmail, isLoggedIn, isApiKeyLogin } =
    useCurrentUser()
  const { tier, subscription, balance, isLoading, fetchBalance } =
    useBillingContext()
  const { formatTierName } = useWorkspaceTierLabel()
  const { canOpenPricingSurface } = useAccountUI()
  const workspaceStore = useTeamWorkspaceStore()

  const firstName = computed(
    () => userDisplayName.value?.trim().split(/\s+/)[0] || undefined
  )

  const initials = computed(() =>
    getUserInitials(userDisplayName.value, userEmail.value)
  )

  const email = computed(() => userEmail.value || undefined)

  const planLabel = computed(
    () =>
      formatTierName(tier.value, subscription.value?.duration === 'ANNUAL') ||
      undefined
  )

  const creditBalance = computed(() => {
    const cents =
      balance.value?.effectiveBalanceMicros ?? balance.value?.amountMicros
    if (cents === undefined) return undefined
    return formatCreditsFromCents({
      cents,
      locale: locale.value,
      numberOptions: { minimumFractionDigits: 0, maximumFractionDigits: 2 }
    })
  })

  const activeWorkspace = computed(() =>
    workspaceStore.initState === 'ready' && !isApiKeyLogin.value
      ? (workspaceStore.activeWorkspace ?? undefined)
      : undefined
  )

  function refreshBalance(): void {
    if (!isLoggedIn.value) return
    void fetchBalance().catch((error: unknown) => {
      reportError(error, {
        surface: 'agent',
        errorType: 'error_refreshing_agent_account_balance'
      })
    })
  }

  return {
    firstName,
    initials,
    email,
    planLabel,
    creditBalance,
    isBalanceLoading: isLoading,
    refreshBalance,
    isLoggedIn,
    canViewPlans: canOpenPricingSurface,
    activeWorkspace
  }
}
