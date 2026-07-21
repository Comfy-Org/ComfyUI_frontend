<script setup lang="ts">
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { TEAM_PLAN_CREDIT_STOPS } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { performSubscriptionCheckout } from '@/platform/cloud/subscription/utils/subscriptionCheckoutUtil'
import { performTeamSubscriptionCheckout } from '@/platform/cloud/subscription/utils/teamSubscriptionCheckoutUtil'

import type { BillingCycle } from '../subscription/utils/subscriptionTierRank'

function isBillingCycle(value: string): value is BillingCycle {
  return value === 'monthly' || value === 'yearly'
}

// Only paid personal tiers can be checked out via this redirect.
function isCheckoutTierKey(value: string): value is TierKey {
  return ['standard', 'creator', 'pro', 'founder'].includes(value)
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { reportError, accessBillingPortal } = useAuthActions()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const { isActiveSubscription, isInitialized, initialize } = useBillingContext()

const selectedTierKey = ref<TierKey | null>(null)

const tierDisplayName = computed(() => {
  if (!selectedTierKey.value) return ''
  const names: Record<TierKey, string> = {
    free: t('subscription.tiers.free.name'),
    standard: t('subscription.tiers.standard.name'),
    creator: t('subscription.tiers.creator.name'),
    pro: t('subscription.tiers.pro.name'),
    founder: t('subscription.tiers.founder.name')
  }
  return names[selectedTierKey.value]
})

// The team plan checks out through the workspace endpoint, which charges the
// payment method on file directly rather than opening a hosted Stripe page. So
// unlike personal tiers (whose checkout URL / billing portal is itself the
// confirmation), a team deep link must present its own confirmation before it
// can charge — otherwise a subscribed user following the link is billed with no
// consent step.
const pendingTeam = ref<{ stopId: string; cycle: BillingCycle } | null>(null)
const teamCheckoutStarted = ref(false)

const teamCreditsLabel = computed(() => {
  if (!pendingTeam.value) return null
  const usd = Number(pendingTeam.value.stopId.replace(/^team_/, ''))
  const stop = TEAM_PLAN_CREDIT_STOPS.find((s) => s.usd === usd)
  return stop ? stop.credits.toLocaleString() : null
})

const teamCycleLabel = computed(() =>
  pendingTeam.value?.cycle === 'yearly'
    ? t('subscription.teamPlan.billedYearly')
    : t('subscription.teamPlan.billedMonthly')
)

const planLabel = computed(() =>
  teamCheckoutStarted.value
    ? t('subscription.teamPlan.name')
    : tierDisplayName.value
)

const runRedirect = wrapWithErrorHandlingAsync(async () => {
  const rawType = route.query.tier
  const rawCycle = route.query.cycle
  let tierKeyParam: string | null = null
  let cycleParam = 'monthly'

  if (typeof rawType === 'string') {
    tierKeyParam = rawType
  } else if (Array.isArray(rawType) && rawType[0]) {
    tierKeyParam = rawType[0]
  }

  if (typeof rawCycle === 'string') {
    cycleParam = rawCycle
  } else if (Array.isArray(rawCycle) && rawCycle[0]) {
    cycleParam = rawCycle[0]
  }

  if (!tierKeyParam) {
    await router.push('/')
    return
  }

  const billingCycle: BillingCycle = isBillingCycle(cycleParam)
    ? cycleParam
    : 'monthly'

  // Team is a per-credit plan picked on a slider, so it carries a `stop` (the
  // chosen credit commitment) instead of a tier. Stage the checkout and wait
  // for explicit confirmation instead of charging on mount.
  if (tierKeyParam === 'team') {
    const rawStop = route.query.stop
    const stopId =
      typeof rawStop === 'string'
        ? rawStop
        : Array.isArray(rawStop)
          ? rawStop[0]
          : null
    if (!stopId) {
      await router.push('/')
      return
    }
    pendingTeam.value = { stopId, cycle: billingCycle }
    return
  }

  if (!isCheckoutTierKey(tierKeyParam)) {
    await router.push('/')
    return
  }

  selectedTierKey.value = tierKeyParam

  if (!isInitialized.value) {
    await initialize()
  }

  if (isActiveSubscription.value) {
    await accessBillingPortal(undefined, false)
  } else {
    await performSubscriptionCheckout(tierKeyParam, billingCycle, {
      openInNewTab: false,
      paymentIntentSource: 'deep_link'
    })
  }
}, reportError)

const confirmTeamCheckout = wrapWithErrorHandlingAsync(async () => {
  const staged = pendingTeam.value
  if (!staged || teamCheckoutStarted.value) return
  teamCheckoutStarted.value = true
  await performTeamSubscriptionCheckout(staged.stopId, staged.cycle, {
    paymentIntentSource: 'deep_link'
  })
}, reportError)

const cancelTeamCheckout = async () => {
  await router.push('/')
}

onMounted(() => {
  void runRedirect()
})
</script>

<template>
  <div
    class="bg-comfy-menu-secondary-bg flex size-full items-center justify-center"
  >
    <div
      v-if="pendingTeam && !teamCheckoutStarted"
      class="flex w-full max-w-sm flex-col items-center gap-4 px-6 text-center"
    >
      <img
        src="/assets/images/comfy-logo-single.svg"
        :alt="t('g.comfyOrgLogoAlt')"
        class="size-16"
      />
      <h1 class="font-inter text-lg/normal font-medium text-base-foreground">
        {{ t('subscription.teamPlan.confirmHeading') }}
      </h1>
      <p
        v-if="teamCreditsLabel"
        class="font-inter text-base/normal font-normal text-base-foreground"
      >
        {{
          t('subscription.teamPlan.confirmCreditsPerMonth', {
            credits: teamCreditsLabel
          })
        }}
        · {{ teamCycleLabel }}
      </p>
      <p class="font-inter text-sm/normal font-normal text-muted">
        {{ t('subscription.teamPlan.confirmChargeNotice') }}
      </p>
      <Button
        class="w-full"
        :label="t('subscription.teamPlan.confirmCta')"
        @click="confirmTeamCheckout"
      />
      <Button
        link
        :label="t('subscription.teamPlan.confirmCancel')"
        @click="cancelTeamCheckout"
      />
    </div>

    <div v-else class="flex flex-col items-center gap-4">
      <img
        src="/assets/images/comfy-logo-single.svg"
        :alt="t('g.comfyOrgLogoAlt')"
        class="size-16"
      />
      <p
        v-if="planLabel"
        class="font-inter text-base/normal font-normal text-base-foreground"
      >
        {{
          t('subscription.subscribeTo', {
            plan: planLabel
          })
        }}
      </p>
      <ProgressSpinner v-if="planLabel" class="size-8" stroke-width="4" />
      <Button
        v-if="planLabel"
        as="a"
        href="/"
        link
        :label="t('cloudOnboarding.skipToCloudApp')"
      />
    </div>
  </div>
</template>
