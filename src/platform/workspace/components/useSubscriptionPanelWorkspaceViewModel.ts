import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'

import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { getTierPrice } from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierBenefit } from '@/platform/cloud/subscription/utils/tierBenefits'
import { getCommonTierBenefits } from '@/platform/cloud/subscription/utils/tierBenefits'
import type { SubscriptionInfo } from '@/composables/billing/types'

import {
  formatRefillsDate,
  formatSubscriptionDate,
  getNextMonthInvoice,
  getPlanTotalCreditsValue,
  getSubscriptionTierKey
} from './subscriptionPanelWorkspace.logic'

interface Permissions {
  canManageSubscription: boolean
  canTopUp: boolean
}

type Translate = (
  key: string,
  params?: Record<string, unknown>,
  options?: Record<string, unknown>
) => string

type NumberFormat = (value: number) => string

interface SubscriptionPanelWorkspaceViewModelArgs {
  isActiveSubscription: Ref<boolean> | ComputedRef<boolean>
  isFreeTierPlan: Ref<boolean> | ComputedRef<boolean>
  subscription:
    | Ref<SubscriptionInfo | null>
    | ComputedRef<SubscriptionInfo | null>
  isWorkspaceSubscribed: Ref<boolean>
  isInPersonalWorkspace: Ref<boolean>
  members: Ref<Array<{ id: string }>>
  permissions: Ref<Permissions> | ComputedRef<Permissions>
  monthlyBonusCredits: Ref<string> | ComputedRef<string>
  t: Translate
  n: NumberFormat
  getMaxSeats: (key: TierKey) => number
  showSubscriptionDialog: () => void
  showPricingTable: () => void
  showCancelSubscriptionDialog: (endDate?: string) => void
}

export function useSubscriptionPanelWorkspaceViewModel(
  args: SubscriptionPanelWorkspaceViewModelArgs
) {
  const subscriptionTier = computed(() => args.subscription.value?.tier ?? null)

  const isYearlySubscription = computed(
    () => args.subscription.value?.duration === 'ANNUAL'
  )

  const isCancelled = computed(
    () =>
      !args.isInPersonalWorkspace.value &&
      (args.subscription.value?.isCancelled ?? false)
  )

  const showSubscribePrompt = computed(() => {
    if (!args.permissions.value.canManageSubscription) return false
    if (isCancelled.value) return false
    if (args.isInPersonalWorkspace.value)
      return !args.isActiveSubscription.value
    return !args.isWorkspaceSubscribed.value
  })

  const isMemberView = computed(
    () =>
      !args.permissions.value.canManageSubscription &&
      !args.isActiveSubscription.value &&
      !args.isWorkspaceSubscribed.value
  )

  const showZeroState = computed(
    () => showSubscribePrompt.value || isMemberView.value
  )

  const formattedRenewalDate = computed(() =>
    formatSubscriptionDate(args.subscription.value?.renewalDate)
  )

  const formattedEndDate = computed(() =>
    formatSubscriptionDate(args.subscription.value?.endDate)
  )

  const tierKey = computed(() => getSubscriptionTierKey(subscriptionTier.value))

  const tierPrice = computed(() =>
    getTierPrice(tierKey.value, isYearlySubscription.value)
  )

  const subscriptionTierName = computed(() => {
    const tier = subscriptionTier.value
    if (!tier) return ''
    const baseName = args.t(`subscription.tiers.${tierKey.value}.name`)
    return isYearlySubscription.value
      ? args.t('subscription.tierNameYearly', { name: baseName })
      : baseName
  })

  const memberCount = computed(() => args.members.value.length)

  const nextMonthInvoice = computed(() =>
    getNextMonthInvoice(memberCount.value, tierPrice.value)
  )

  const refillsDate = computed(() =>
    formatRefillsDate(args.subscription.value?.renewalDate)
  )

  const creditsRemainingLabel = computed(() =>
    isYearlySubscription.value
      ? args.t(
          'subscription.creditsRemainingThisYear',
          { date: refillsDate.value },
          { escapeParameter: false }
        )
      : args.t(
          'subscription.creditsRemainingThisMonth',
          { date: refillsDate.value },
          { escapeParameter: false }
        )
  )

  const planTotalCredits = computed(() => {
    const total = getPlanTotalCreditsValue(
      tierKey.value,
      isYearlySubscription.value
    )
    return total === null ? '—' : args.n(total)
  })

  const includedCreditsDisplay = computed(
    () => `${args.monthlyBonusCredits.value} / ${planTotalCredits.value}`
  )

  const tierBenefits = computed((): TierBenefit[] => {
    const benefits: TierBenefit[] = []

    if (!args.isInPersonalWorkspace.value) {
      benefits.push({
        key: 'members',
        type: 'icon',
        label: args.t('subscription.membersLabel', {
          count: args.getMaxSeats(tierKey.value)
        }),
        icon: 'pi pi-user'
      })
    }

    benefits.push(...getCommonTierBenefits(tierKey.value, args.t, args.n))
    return benefits
  })

  const planMenuItems = computed(() => [
    {
      label: args.t('subscription.cancelSubscription'),
      icon: 'pi pi-times',
      command: () => {
        args.showCancelSubscriptionDialog(
          args.subscription.value?.endDate ?? undefined
        )
      }
    }
  ])

  function handleSubscribeWorkspace() {
    args.showSubscriptionDialog()
  }

  function handleUpgrade() {
    if (args.isFreeTierPlan.value) args.showPricingTable()
    else args.showSubscriptionDialog()
  }

  function handleUpgradeToAddCredits() {
    args.showPricingTable()
  }

  return {
    isCancelled,
    showSubscribePrompt,
    isMemberView,
    showZeroState,
    handleSubscribeWorkspace,
    handleUpgrade,
    handleUpgradeToAddCredits,
    subscriptionTier,
    isYearlySubscription,
    formattedRenewalDate,
    formattedEndDate,
    subscriptionTierName,
    planMenuItems,
    tierKey,
    tierPrice,
    memberCount,
    nextMonthInvoice,
    refillsDate,
    creditsRemainingLabel,
    planTotalCredits,
    includedCreditsDisplay,
    tierBenefits
  }
}
