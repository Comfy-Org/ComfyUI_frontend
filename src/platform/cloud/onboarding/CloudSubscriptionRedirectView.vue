<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery, LocationQueryValue } from 'vue-router'

import Button from '@comfyorg/design-system/button/Button'
import AppSpinner from '@/components/common/AppSpinner.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { TierKey } from '@/platform/billing/subscription/constants/tierPricing'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { getPricingCheckoutSelection } from '@/platform/billing/subscription/composables/usePricingTableUrlLoader'
import type {
  CheckoutTierKey,
  SubscriptionDialogOptions
} from '@/platform/billing/composables/types'

import type { BillingCycle } from '@/platform/billing/subscription/utils/subscriptionTierRank'

function isBillingCycle(value: string): value is BillingCycle {
  return value === 'monthly' || value === 'yearly'
}

// Only paid personal tiers can be checked out via this redirect.
function isCheckoutTierKey(value: string): value is CheckoutTierKey {
  return ['standard', 'creator', 'pro'].includes(value)
}

function isPaidPersonalTierKey(
  value: string
): value is Exclude<TierKey, 'free'> {
  return isCheckoutTierKey(value) || value === 'founder'
}

function firstQueryValue(
  value: LocationQueryValue | LocationQueryValue[] | undefined
): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

type SubscribeLink =
  | { tierKey: 'team'; stopId: string; billingCycle: BillingCycle }
  | { tierKey: Exclude<TierKey, 'free'>; billingCycle: BillingCycle }

function subscribeLinkFrom(query: LocationQuery): SubscribeLink | null {
  const tierKey = firstQueryValue(query.tier)
  const cycle = firstQueryValue(query.cycle)
  const billingCycle: BillingCycle =
    cycle && isBillingCycle(cycle) ? cycle : 'monthly'
  if (tierKey === 'team') {
    const stopId = firstQueryValue(query.stop)
    return stopId ? { tierKey, stopId, billingCycle } : null
  }
  return tierKey && isPaidPersonalTierKey(tierKey)
    ? { tierKey, billingCycle }
    : null
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { reportError } = useAuthActions()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { showPricingTable } = useSubscriptionDialog()
const { flags } = useFeatureFlags()
const { permissions } = useBillingUI()
const {
  canOpenPlans,
  hasResolvedCapabilities,
  initialize: initializeCapabilities,
  refresh: refreshCapabilities
} = useBillingCapabilities()

const {
  canAccessSubscriptionFeatures,
  isInitialized,
  teamCreditStops,
  initialize,
  fetchPlans,
  manageSubscription
} = useBillingContext()

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

function personalPricingOptions(
  tierKey: Exclude<TierKey, 'free'>,
  billingCycle: BillingCycle
): SubscriptionDialogOptions {
  const options = {
    reason: 'deep_link',
    sameTab: true,
    planMode: 'personal'
  } as const
  return isCheckoutTierKey(tierKey)
    ? {
        ...options,
        initialCheckout: { planMode: 'personal', tierKey, billingCycle }
      }
    : options
}

async function teamPricingOptions(
  stopId: string,
  billingCycle: BillingCycle
): Promise<SubscriptionDialogOptions> {
  if (!teamCreditStops.value) await fetchPlans().catch(reportError)
  return {
    reason: 'deep_link',
    sameTab: true,
    planMode: 'team',
    initialCheckout: getPricingCheckoutSelection(
      'team',
      stopId,
      billingCycle,
      teamCreditStops.value
    )
  }
}

async function leftWithoutPlans(): Promise<boolean> {
  if (!flags.billingNewUxEnabled) {
    if (!canAccessSubscriptionFeatures.value) return false
    await manageSubscription()
    return true
  }
  await initializeCapabilities()
  if (!hasResolvedCapabilities.value) await refreshCapabilities()
  if (canOpenPlans.value) return false
  await router.replace('/')
  return (
    canAccessSubscriptionFeatures.value ||
    permissions.value.canManageSubscription
  )
}

const runRedirect = wrapWithErrorHandlingAsync(async () => {
  const link = subscribeLinkFrom(route.query)
  if (!link) {
    await router.push('/')
    return
  }

  if (link.tierKey === 'team') isTeamCheckout.value = true
  else selectedTierKey.value = link.tierKey

  if (!isInitialized.value) {
    await initialize()
  }

  if (await leftWithoutPlans()) return

  showPricingTable(
    link.tierKey === 'team'
      ? await teamPricingOptions(link.stopId, link.billingCycle)
      : personalPricingOptions(link.tierKey, link.billingCycle)
  )
}, reportError)

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
  void runRedirect()
})
</script>

<template>
  <div class="flex size-full items-center justify-center bg-secondary">
    <div class="flex flex-col items-center gap-4">
      <img
        src="/assets/images/comfy-logo-single.svg"
        :alt="t('g.comfyOrgLogoAlt')"
        class="size-16"
      />
      <p
        v-if="planLabel"
        class="font-inter text-base/normal font-normal text-foreground"
      >
        {{
          t('subscription.subscribeTo', {
            plan: planLabel
          })
        }}
      </p>
      <AppSpinner v-if="planLabel" class="size-8" />
      <Button v-if="planLabel" as="a" href="/" variant="link">
        {{ t('cloudOnboarding.skipToCloudApp') }}
      </Button>
    </div>
  </div>
</template>
