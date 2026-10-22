import { computed } from 'vue'

import { useBillingBanner } from '@/platform/billing/composables/useBillingBanner'

interface PausedBannerCopy {
  muted: boolean
  titleKey: string
  bodyKey: string
  action: 'updatePayment' | null
}

const OWNER_COPY: PausedBannerCopy = {
  muted: false,
  titleKey: 'subscription.paymentRecovery.title',
  bodyKey: 'workspacePanel.billingStatus.paused.body',
  action: 'updatePayment'
}

const MEMBER_COPY: PausedBannerCopy = {
  muted: true,
  titleKey: 'subscription.paymentRecovery.title',
  bodyKey: 'subscription.paymentRecovery.memberDescription',
  action: null
}

/** The Subscription paused copy every billing surface renders for `can_manage_billing` as received. */
export function pausedBannerCopy(canManageBilling: boolean): PausedBannerCopy {
  return canManageBilling ? OWNER_COPY : MEMBER_COPY
}

/** Whether the served billing status puts the Subscription paused banner on every billing surface. */
export function usePausedBanner() {
  const { kind } = useBillingBanner()
  return { isPaused: computed(() => kind.value === 'paused') }
}
