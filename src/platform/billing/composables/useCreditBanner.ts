import {
  deriveLocalCreditBanner,
  isMemberTopUpDenial
} from '@comfyorg/account-core/billing'
import type {
  BillingBannerAction,
  BillingBannerCopy,
  BillingBannerView
} from '@comfyorg/account-ui/billing'
import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  centsToCredits,
  formatCreditsFromCents
} from '@/base/credits/comfyCredits'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAutoTopUpBannerKind } from '@/platform/billing/composables/useAutoTopUpBannerKind'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import { useLongDate } from '@/platform/billing/composables/useLongDate'
import {
  isTopUpDeniedPastDue,
  usePaymentRecoveryDialog
} from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'
import { isCloud } from '@/platform/distribution/types'

type CreditAction = 'addCredits' | 'updatePayment' | null

const bs = 'workspacePanel.billingStatus'

/** The Billing tab's credit or auto top-up banner, its copy and its handlers. */
export function useCreditBanner(suppressed: MaybeRefOrGetter<boolean>) {
  const billing = useBillingContext()
  const { flags } = useFeatureFlags()
  const { workspaceType } = useBillingUI()
  const {
    canTopUp,
    topUpDenial,
    hasResolvedCapabilities,
    canManageBilling,
    runDeniedPaymentPastDue
  } = useBillingCapabilities()
  const { showTopUpCreditsDialog } = useBillingDialogs()
  const { updatePayment, isUpdatingPayment } = usePaymentRecoveryDialog()
  const { t, locale } = useI18n()
  const { longDate } = useLongDate()

  const outOfCreditsDismissed = ref(false)
  const lowCreditsDismissed = ref(false)

  const { subscription, balance, isTeamPlan } = billing

  const autoTopUp = useAutoTopUpBannerKind()
  const { href, track } = usePlatformHandoff('/profile/billing', {
    target: 'auto_top_up',
    action: 'update_payment'
  })

  const kind = computed(() => {
    if (toValue(suppressed)) return null
    if (isCloud && autoTopUp.value) return autoTopUp.value
    return deriveLocalCreditBanner({
      autoTopUp: autoTopUp.value,
      unifiedBillingSettingsEnabled: flags.unifiedBillingSettingsEnabled,
      isCloud,
      isActive: subscription.value?.isActive === true,
      hasFunds: subscription.value?.hasFunds ?? null,
      lowBalance: balance.value?.lowBalance,
      outOfCreditsDismissed: outOfCreditsDismissed.value,
      lowCreditsDismissed: lowCreditsDismissed.value
    })
  })

  watch(
    () => subscription.value?.hasFunds === false,
    (exhausted) => {
      if (!exhausted) outOfCreditsDismissed.value = false
    }
  )

  watch(
    () => balance.value?.lowBalance === true,
    (low) => {
      if (!low) lowCreditsDismissed.value = false
    }
  )

  const availableCents = computed(() => {
    const current = balance.value
    if (!current) return null
    return current.effectiveBalanceMicros ?? current.amountMicros
  })

  watch(availableCents, (cents, previous) => {
    if (previous != null && cents !== previous)
      lowCreditsDismissed.value = false
  })

  const audience = computed(() => (isTeamPlan.value ? 'team' : 'personal'))

  const refillDate = computed(() => longDate(billing.nextCreditRefillAt.value))

  function datedBody(key: string, noDateKey: string): string {
    return refillDate.value ? t(key, { date: refillDate.value }) : t(noDateKey)
  }

  function pastDueBodyKey(): string {
    if (audience.value === 'personal') {
      return `${bs}.outOfCredits.pastDuePersonalBody`
    }
    return canManageBilling.value
      ? `${bs}.outOfCredits.pastDueBody`
      : `${bs}.outOfCredits.pastDueMemberBody`
  }

  function creditView(
    kindKey: 'outOfCredits' | 'lowCredits',
    body: string,
    action: CreditAction
  ): BillingBannerView {
    return {
      kind: 'credit',
      title: t(`${bs}.${kindKey}.title`),
      body,
      action,
      dismissKey: kindKey
    }
  }

  function refusedOutOfCreditsBody(): string {
    const denial = topUpDenial.value
    if (isMemberTopUpDenial(denial)) {
      return datedBody(
        `${bs}.outOfCredits.memberBody`,
        `${bs}.outOfCredits.memberBodyNoDate`
      )
    }
    if (denial === 'topup_purchases_paused') {
      return audience.value === 'personal'
        ? datedBody(
            `${bs}.outOfCredits.pausedPersonalBody`,
            `${bs}.outOfCredits.pausedPersonalBodyNoDate`
          )
        : datedBody(
            `${bs}.outOfCredits.pausedBody`,
            `${bs}.outOfCredits.pausedBodyNoDate`
          )
    }
    return t(
      audience.value === 'personal'
        ? `${bs}.outOfCredits.refusedPersonalBody`
        : `${bs}.outOfCredits.refusedBody`
    )
  }

  function outOfCreditsView(): BillingBannerView | null {
    if (
      runDeniedPaymentPastDue.value ||
      isTopUpDeniedPastDue(topUpDenial.value)
    ) {
      return creditView(
        'outOfCredits',
        t(pastDueBodyKey()),
        canManageBilling.value ? 'updatePayment' : null
      )
    }
    if (canTopUp.value) {
      const personal = audience.value === 'personal'
      return creditView(
        'outOfCredits',
        datedBody(
          personal
            ? `${bs}.outOfCredits.personalBody`
            : `${bs}.outOfCredits.body`,
          personal
            ? `${bs}.outOfCredits.personalBodyNoDate`
            : `${bs}.outOfCredits.bodyNoDate`
        ),
        'addCredits'
      )
    }
    if (!hasResolvedCapabilities.value) return null
    return creditView('outOfCredits', refusedOutOfCreditsBody(), null)
  }

  function creditsLeft(): string {
    const cents = availableCents.value
    if (cents == null) return ''
    return formatCreditsFromCents({
      cents,
      locale: locale.value,
      numberOptions: { minimumFractionDigits: 0, maximumFractionDigits: 0 }
    })
  }

  function lowCreditsBodyKey(): string {
    if (topUpDenial.value === 'topup_purchases_paused')
      return `${bs}.lowCredits.pausedBody`
    if (!isCloud) return `${bs}.lowCredits.localBody`
    if (workspaceType.value !== 'team') return `${bs}.lowCredits.personalBody`
    return canManageBilling.value
      ? `${bs}.lowCredits.ownerBody`
      : `${bs}.lowCredits.memberBody`
  }

  function lowCreditsView(): BillingBannerView {
    return creditView(
      'lowCredits',
      t(
        lowCreditsBodyKey(),
        { credits: creditsLeft() },
        centsToCredits(availableCents.value ?? 0)
      ),
      canTopUp.value ? 'addCredits' : null
    )
  }

  const view = computed<BillingBannerView | null>(() => {
    const shown = kind.value
    if (shown === 'autoTopUpFailed' || shown === 'autoTopUpOff') {
      return {
        kind: 'autoTopUp',
        title: t(`${bs}.${shown}.title`),
        body: t(`${bs}.${shown}.body`),
        action: 'updatePayment',
        href: href.value
      }
    }
    if (shown === 'outOfCredits') return outOfCreditsView()
    if (shown === 'lowCredits') return lowCreditsView()
    return null
  })

  const copy = computed<Pick<BillingBannerCopy, 'dismiss' | 'actions'>>(() => ({
    dismiss: t(`${bs}.outOfCredits.dismiss`),
    actions: {
      addCredits: t(`${bs}.outOfCredits.addCredits`),
      updatePayment: t(`${bs}.updatePayment`),
      verifyPayment: t(`${bs}.planCheckout.verifyPayment.action`),
      contactSupport: t(`${bs}.parked.contactSupport`),
      resumePlan: t(`${bs}.ending.reactivate`),
      choosePlan: t('workspacePanel.billingTab.plan.actions.choosePlan'),
      contactSales: t(`${bs}.ending.contactSales`)
    }
  }))

  function dismiss() {
    const visible = kind.value
    if (visible === 'outOfCredits') {
      outOfCreditsDismissed.value = true
      if (balance.value?.lowBalance === true) lowCreditsDismissed.value = true
    } else if (visible === 'lowCredits') {
      lowCreditsDismissed.value = true
    }
  }

  function act(action: BillingBannerAction) {
    if (view.value?.kind === 'autoTopUp') track()
    else if (action === 'addCredits') void showTopUpCreditsDialog()
    else if (action === 'updatePayment') void updatePayment()
  }

  return { view, copy, isUpdatingPayment, dismiss, act }
}
