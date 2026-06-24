<script setup lang="ts">
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { performSubscriptionCheckout } from '@/platform/cloud/subscription/utils/subscriptionCheckoutUtil'
import { performTeamSubscriptionCheckout } from '@/platform/cloud/subscription/utils/teamSubscriptionCheckoutUtil'

import type { BillingCycle } from '../subscription/utils/subscriptionTierRank'

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

const isTeamCheckout = ref(false)

const planLabel = computed(() =>
  isTeamCheckout.value ? t('subscription.teamPlan.name') : tierDisplayName.value
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

  const validCycles: BillingCycle[] = ['monthly', 'yearly']
  const billingCycle: BillingCycle = (validCycles as string[]).includes(
    cycleParam
  )
    ? (cycleParam as BillingCycle)
    : 'monthly'

  // Team is a per-credit plan picked on a slider, so it carries a `stop` (the
  // chosen credit commitment) instead of a tier and checks out through the
  // workspace billing endpoint rather than the personal one.
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
    isTeamCheckout.value = true
    await performTeamSubscriptionCheckout(stopId, billingCycle)
    return
  }

  // Only paid personal tiers can be checked out via redirect
  const validTierKeys: TierKey[] = ['standard', 'creator', 'pro', 'founder']
  if (!(validTierKeys as string[]).includes(tierKeyParam)) {
    await router.push('/')
    return
  }

  const tierKey = tierKeyParam as TierKey

  selectedTierKey.value = tierKey

  if (!isInitialized.value) {
    await initialize()
  }

  if (isActiveSubscription.value) {
    await accessBillingPortal(undefined, false)
  } else {
    await performSubscriptionCheckout(tierKey, billingCycle, false)
  }
}, reportError)

onMounted(() => {
  void runRedirect()
})
</script>

<template>
  <div
    class="bg-comfy-menu-secondary-bg flex size-full items-center justify-center"
  >
    <div class="flex flex-col items-center gap-4">
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
