import { computed, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

/**
 * Composable for handling subscription credit calculations and formatting.
 *
 * Uses the appropriate billing source based on workspace type:
 * - Personal workspaces: uses firebaseAuthStore balance (legacy /customers endpoint)
 * - Team workspaces: uses billingContext balance (/billing/balance endpoint)
 */
export function useSubscriptionCredits() {
  const authStore = useFirebaseAuthStore()
  const workspaceStore = useTeamWorkspaceStore()
  const billingContext = useBillingContext()
  const { locale } = useI18n()

  const formatBalance = (maybeCents?: number) => {
    // Backend returns cents despite the *_micros naming convention.
    const cents = maybeCents ?? 0
    const amount = formatCreditsFromCents({
      cents,
      locale: locale.value,
      numberOptions: {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }
    })
    return amount
  }

  const totalCredits = computed(() => {
    if (workspaceStore.isInPersonalWorkspace) {
      return formatBalance(authStore.balance?.amount_micros)
    }
    const balance = toValue(billingContext.balance)
    return formatBalance(balance?.amountMicros)
  })

  const monthlyBonusCredits = computed(() => {
    if (workspaceStore.isInPersonalWorkspace) {
      return formatBalance(authStore.balance?.cloud_credit_balance_micros)
    }
    const balance = toValue(billingContext.balance)
    return formatBalance(balance?.cloudCreditBalanceMicros)
  })

  const prepaidCredits = computed(() => {
    if (workspaceStore.isInPersonalWorkspace) {
      return formatBalance(authStore.balance?.prepaid_balance_micros)
    }
    const balance = toValue(billingContext.balance)
    return formatBalance(balance?.prepaidBalanceMicros)
  })

  const isLoadingBalance = computed(() => {
    if (workspaceStore.isInPersonalWorkspace) {
      return authStore.isFetchingBalance
    }
    return toValue(billingContext.isLoading)
  })

  return {
    totalCredits,
    monthlyBonusCredits,
    prepaidCredits,
    isLoadingBalance
  }
}
