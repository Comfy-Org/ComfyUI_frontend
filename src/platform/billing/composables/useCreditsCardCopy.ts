import type {
  CreditsBreakdownCopy,
  CreditsCardCopy
} from '@comfyorg/account-ui/billing'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const k = 'workspacePanel.billingTab.credits'

/** The Billing tab Credits card strings in the app locale. */
export function useCreditsCardCopy() {
  const { t } = useI18n()
  return computed<CreditsCardCopy>(() => ({
    title: t(`${k}.title`),
    rateInfo: t(`${k}.tooltipLabel`),
    rateTooltip: t(`${k}.tooltip`),
    available: t(`${k}.available`),
    unavailable: t(`${k}.unavailable`),
    tryAgain: t('workspacePanel.billingTab.tryAgain'),
    overdrawn: (count, credits) => t(`${k}.overdrawn`, { count }, credits),
    plan: t(`${k}.plan`),
    planTooltip: t(`${k}.planTooltip`),
    planOfPool: t(`${k}.planOfPool`, {
      remaining: '{remaining}',
      total: '{total}'
    }),
    planUsed: (percent) => t(`${k}.planUsed`, { percent }),
    refills: (date) => t('subscription.refillsDate', { date }),
    refillsAfterPayment: t('subscription.refillsAfterPayment'),
    availableUntil: (date) => t(`${k}.availableUntil`, { date }),
    topUp: t(`${k}.topUp`),
    topUpTooltip: t(`${k}.topUpTooltip`),
    inUse: t(`${k}.inUse`),
    addCredits: t(`${k}.addCredits`),
    addCreditsReason: (reasonKey) => t(reasonKey)
  }))
}

/** The credits flyout breakdown strings in the app locale. */
export function useCreditsBreakdownCopy() {
  const { t } = useI18n()
  return computed<CreditsBreakdownCopy>(() => ({
    planCredits: t('profileMenu.planCredits'),
    topUpCredits: t('profileMenu.topUpCredits'),
    planOfPool: t(`${k}.planOfPool`, {
      remaining: '{remaining}',
      total: '{total}'
    }),
    refills: (date) => t('subscription.refillsDate', { date }),
    refillsAfterPayment: t('subscription.refillsAfterPayment'),
    availableUntil: (date) => t(`${k}.availableUntil`, { date }),
    unavailable: t('profileMenu.balanceUnavailable')
  }))
}
