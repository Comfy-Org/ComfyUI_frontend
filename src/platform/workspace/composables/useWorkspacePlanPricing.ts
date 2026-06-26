import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import {
  TIER_TO_KEY,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { formatUsdCents } from '@/utils/numberUtil'

/**
 * Resolves the price shown in the Plan & Credits header into a ready-to-render
 * string + unit label.
 *
 * Team pricing comes from the subscribed credit stop's per-month price (the
 * cycle `price_cents` is the authoritative recurring charge; `stop_usd` only
 * names the ladder rung). Both monthly and yearly stops are per-month figures.
 * When the subscribed stop id is absent from the resolved ladder the facade is
 * stale, so pricing warns and falls back to the per-member tier price rather
 * than silently mispricing an active plan.
 */
export function useWorkspacePlanPricing() {
  const { t, locale } = useI18n()
  const { isInPersonalWorkspace } = storeToRefs(useTeamWorkspaceStore())
  const { subscription, teamCreditStops, currentTeamCreditStop } =
    useBillingContext()

  const isYearly = computed(() => subscription.value?.duration === 'ANNUAL')

  // No subscription tier means an unsubscribed (Free) workspace; a present but
  // unmapped tier falls back to the per-member standard price.
  const tierKey = computed<TierKey>(() => {
    const tier = subscription.value?.tier
    if (!tier) return 'free'
    return TIER_TO_KEY[tier] ?? 'standard'
  })

  const subscribedStop = computed(() => {
    if (isInPersonalWorkspace.value) return null
    const id = currentTeamCreditStop.value?.id
    const stops = teamCreditStops.value?.stops
    if (!id || !stops) return null
    return stops.find((stop) => stop.id === id) ?? null
  })

  const hasStaleCreditStop = computed(
    () =>
      !isInPersonalWorkspace.value &&
      !!currentTeamCreditStop.value &&
      !!teamCreditStops.value &&
      subscribedStop.value === null
  )

  const teamMonthlyCostCents = computed(() => {
    const stop = subscribedStop.value
    if (!stop) return null
    return isYearly.value ? stop.yearly.price_cents : stop.monthly.price_cents
  })

  const displayPrice = computed(() => {
    const cents =
      teamMonthlyCostCents.value ??
      getTierPrice(tierKey.value, isYearly.value) * 100
    return formatUsdCents(locale.value, cents)
  })

  const priceUnitLabel = computed(() =>
    teamMonthlyCostCents.value !== null || isInPersonalWorkspace.value
      ? t('subscription.usdPerMonth')
      : t('subscription.usdPerMonthPerMember')
  )

  watch(hasStaleCreditStop, (isStale) => {
    if (isStale) {
      console.warn(
        `Subscribed credit stop "${currentTeamCreditStop.value?.id}" not found in the resolved ladder; falling back to per-member pricing.`
      )
    }
  })

  return {
    displayPrice,
    priceUnitLabel
  }
}
