<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-center">
      <ToggleGroup
        v-model="currentBillingCycle"
        type="single"
        :allow-empty="false"
        class="rounded-lg bg-secondary p-1.5"
      >
        <ToggleGroupItem
          v-for="option in billingCycleOptions"
          :key="option.value"
          :value="option.value"
          class="h-8 w-36 data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          <div class="flex items-center gap-2">
            <span>{{ option.label }}</span>
            <Badge
              v-if="option.value === 'yearly'"
              variant="pill"
              severity="default"
              class="font-bold"
            >
              {{ t('subscription.saveYearly') }}
            </Badge>
          </div>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
    <div class="flex flex-col gap-4 xl:flex-row">
      <div
        v-for="tier in tiers"
        :key="tier.id"
        :class="
          cn(
            'flex flex-1 flex-col rounded-2xl border bg-background shadow-sm',
            tier.isPopular ? 'border-muted-foreground' : ''
          )
        "
      >
        <div class="flex flex-col gap-4 p-6 pb-0">
          <PricingTierHeading :name="tier.name" :is-popular="tier.isPopular" />
          <div class="flex flex-col">
            <div class="flex flex-col gap-2">
              <div class="flex items-baseline gap-2">
                <span
                  class="text-[28px] leading-normal font-semibold tabular-nums"
                >
                  ${{ getPrice(tier) }}
                  <span
                    v-show="currentBillingCycle === 'yearly'"
                    class="text-2xl text-muted-foreground line-through"
                  >
                    ${{ tier.pricing.monthly }}
                  </span>
                </span>
                <span class="text-xl/normal">
                  {{ t('subscription.usdPerMonth') }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">
                  {{
                    currentBillingCycle === 'yearly'
                      ? t('subscription.billedYearly', {
                          total: `$${getAnnualTotal(tier)}`
                        })
                      : t('subscription.billedMonthly')
                  }}
                </span>
              </div>
            </div>
          </div>

          <p
            role="note"
            :aria-label="t('subscription.soloUseOnly')"
            class="m-0 flex h-10 items-center rounded-lg bg-muted-foreground/30 px-3 text-sm text-muted-foreground"
          >
            {{ t('subscription.soloUseOnly') }}
            <span class="mx-1">–</span>
            <button
              class="cursor-pointer border-none bg-transparent p-0 font-medium underline hover:text-foreground focus-visible:ring-1 focus-visible:outline-none"
              @click="emit('chooseTeamWorkspace')"
            >
              {{ t('subscription.needTeamWorkspace') }}
            </button>
          </p>

          <div class="flex flex-1 flex-col gap-3 pb-0">
            <div class="flex items-center justify-between">
              <span class="text-sm/normal font-normal">
                {{
                  currentBillingCycle === 'yearly'
                    ? t('subscription.yearlyCreditsLabel')
                    : t('subscription.monthlyCreditsLabel')
                }}
              </span>
              <div class="flex items-center gap-1">
                <i
                  class="icon-[lucide--coins] shrink-0 bg-credit"
                  aria-hidden="true"
                />
                <span class="text-sm/normal font-bold tabular-nums">
                  {{ n(getCreditsDisplay(tier)) }}
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm font-normal">
                {{ t('subscription.maxDurationLabel') }}
              </span>
              <span class="text-sm/normal font-bold tabular-nums">
                {{ tier.maxDuration }}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm font-normal">
                {{ t('subscription.gpuLabel') }}
              </span>
              <i class="pi pi-check text-xs text-success" />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm font-normal">
                {{ t('subscription.addCreditsLabel') }}
              </span>
              <i class="pi pi-check text-xs text-success" />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-sm font-normal">
                {{ t('subscription.customLoRAsLabel') }}
              </span>
              <i
                v-if="tier.customLoRAs"
                class="pi pi-check text-xs text-success"
              />
              <i v-else class="pi pi-times text-xs" />
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-start justify-between">
                <div class="flex flex-col gap-2">
                  <span class="text-sm/relaxed font-normal">
                    {{ t('subscription.videoEstimateLabel') }}
                  </span>
                  <div
                    class="group flex items-center gap-2 pt-2 text-muted-foreground"
                  >
                    <i
                      class="pi pi-question-circle text-xs group-hover:text-foreground"
                    />
                    <PopoverRoot>
                      <PopoverTrigger as-child>
                        <button
                          class="cursor-pointer border-0 bg-transparent p-0 text-sm font-normal group-hover:text-foreground"
                        >
                          {{ t('subscription.videoEstimateHelp') }}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        dismiss-on-viewport-change
                        class="max-h-(--reka-popover-content-available-height) w-auto max-w-sm overflow-auto rounded-lg border-border/50 shadow-lg data-[state=open]:animate-none"
                      >
                        <div class="flex flex-col gap-2">
                          <p class="text-sm/normal text-foreground">
                            {{ t('subscription.videoEstimateExplanation') }}
                          </p>
                          <a
                            href="https://cloud.comfy.org/?template=video_wan2_2_14B_i2v"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex gap-1 text-sm text-primary no-underline hover:text-primary/80"
                          >
                            <span class="underline">{{
                              t('subscription.videoEstimateTryTemplate')
                            }}</span>
                            <span class="no-underline">→</span>
                          </a>
                        </div>
                      </PopoverContent>
                    </PopoverRoot>
                  </div>
                </div>
                <span class="text-sm/normal font-bold tabular-nums">
                  ~{{ n(getVideoEstimateDisplay(tier)) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-col p-6">
          <Button
            :variant="getButtonSeverity(tier)"
            :disabled="isLoading || isCurrentPlan(tier.key)"
            :loading="loadingTier === tier.key"
            :class="
              cn(
                'h-10 w-full',
                getButtonTextClass(tier),
                tier.key === 'creator'
                  ? 'border-transparent bg-foreground hover:bg-foreground/90'
                  : 'border-transparent bg-secondary hover:bg-accent focus:bg-muted'
              )
            "
            :data-dd-action-name="planCtaActionName(tier.key)"
            @click="() => handleSubscribe(tier.key)"
          >
            {{ getButtonLabel(tier) }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Badge from '@comfyorg/design-system/badge/Badge'
import PricingTierHeading from '@/platform/billing/components/PricingTierHeading.vue'
import { planCtaActionName } from '@/platform/telemetry/billingActionNames'
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import ToggleGroup from '@comfyorg/design-system/toggle-group/ToggleGroup'
import ToggleGroupItem from '@comfyorg/design-system/toggle-group/ToggleGroupItem'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import {
  TIER_PRICING,
  amountForBillingCycle,
  toTierKey
} from '@/platform/billing/subscription/constants/tierPricing'
import type {
  RegistrySubscriptionTier,
  TierKey,
  TierPricing
} from '@/platform/billing/subscription/constants/tierPricing'
import {
  persistPendingSubscriptionCheckoutAttempt,
  withPendingCheckoutAttemptId
} from '@/platform/billing/subscription/utils/subscriptionCheckoutTracker'
import {
  performSubscriptionCheckout,
  runReportedCheckoutAttempt
} from '@/platform/billing/subscription/utils/subscriptionCheckoutUtil'
import { isPlanDowngrade } from '@/platform/billing/subscription/utils/subscriptionTierRank'
import type { BillingCycle } from '@/platform/billing/subscription/utils/subscriptionTierRank'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type {
  CheckoutAttributionMetadata,
  PaymentIntentSource
} from '@/platform/telemetry/types'
import { PaymentPopupBlockedError } from '@/platform/telemetry/utils/billingFailureCategory'
import { useAuthStore } from '@/stores/authStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

type CheckoutTierKey = Exclude<TierKey, 'free' | 'founder'>
type CheckoutTier = CheckoutTierKey | `${CheckoutTierKey}-yearly`

const getCheckoutTier = (
  tierKey: CheckoutTierKey,
  billingCycle: BillingCycle
): CheckoutTier => (billingCycle === 'yearly' ? `${tierKey}-yearly` : tierKey)

const getCheckoutAttributionForCloud =
  async (): Promise<CheckoutAttributionMetadata> => {
    if (__DISTRIBUTION__ !== 'cloud') {
      return {}
    }

    const { getCheckoutAttribution } =
      await import('@/platform/telemetry/utils/checkoutAttribution')

    return getCheckoutAttribution()
  }

interface BillingCycleOption {
  label: string
  value: BillingCycle
}

interface PricingTierConfig {
  id: RegistrySubscriptionTier
  key: CheckoutTierKey
  name: string
  pricing: TierPricing
  maxDuration: string
  customLoRAs: boolean
  isPopular?: boolean
}

const { reason } = defineProps<{
  reason?: PaymentIntentSource
}>()

const emit = defineEmits<{
  chooseTeamWorkspace: []
}>()

const { t, n } = useI18n()

const billingCycleOptions: BillingCycleOption[] = [
  { label: t('subscription.yearly'), value: 'yearly' },
  { label: t('subscription.monthly'), value: 'monthly' }
]

const tiers: PricingTierConfig[] = [
  {
    id: 'STANDARD',
    key: 'standard',
    name: t('subscription.tiers.standard.name'),
    pricing: TIER_PRICING.standard,
    maxDuration: t('subscription.maxDuration.standard'),
    customLoRAs: false,
    isPopular: false
  },
  {
    id: 'CREATOR',
    key: 'creator',
    name: t('subscription.tiers.creator.name'),
    pricing: TIER_PRICING.creator,
    maxDuration: t('subscription.maxDuration.creator'),
    customLoRAs: true,
    isPopular: true
  },
  {
    id: 'PRO',
    key: 'pro',
    name: t('subscription.tiers.pro.name'),
    pricing: TIER_PRICING.pro,
    maxDuration: t('subscription.maxDuration.pro'),
    customLoRAs: true,
    isPopular: false
  }
]
const {
  canAccessSubscriptionFeatures,
  isFreeTier,
  tier: subscriptionTier,
  subscription
} = useBillingContext()

const isYearlySubscription = computed(
  () => subscription.value?.duration === 'ANNUAL'
)
const telemetry = useTelemetry()
const { userId } = storeToRefs(useAuthStore())
const workspaceStore = useTeamWorkspaceStore()
const { accessBillingPortal, accessBillingPortalDirect, reportError } =
  useAuthActions()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const isLoading = ref(false)
const loadingTier = ref<CheckoutTierKey | null>(null)
const currentBillingCycle = ref<BillingCycle>('yearly')

const hasPaidSubscription = computed(
  () => canAccessSubscriptionFeatures.value && !isFreeTier.value
)

const currentTierKey = computed<TierKey | null>(() =>
  subscriptionTier.value ? toTierKey(subscriptionTier.value) : null
)

const currentPlanDescriptor = computed(() => {
  if (!currentTierKey.value) return null

  return {
    tierKey: currentTierKey.value,
    billingCycle: isYearlySubscription.value ? 'yearly' : 'monthly'
  } as const
})

const isCurrentPlan = (tierKey: CheckoutTierKey): boolean => {
  if (!currentTierKey.value) return false

  const selectedIsYearly = currentBillingCycle.value === 'yearly'

  return (
    currentTierKey.value === tierKey &&
    isYearlySubscription.value === selectedIsYearly
  )
}

const getButtonLabel = (tier: PricingTierConfig): string => {
  if (isCurrentPlan(tier.key)) return t('subscription.currentPlan')

  const planName =
    currentBillingCycle.value === 'yearly'
      ? t('subscription.tierNameYearly', { name: tier.name })
      : tier.name

  return hasPaidSubscription.value
    ? t('subscription.changeTo', { plan: planName })
    : t('subscription.subscribeTo', { plan: planName })
}

const getButtonSeverity = (
  tier: PricingTierConfig
): 'primary' | 'secondary' => {
  if (isCurrentPlan(tier.key)) return 'secondary'
  if (tier.key === 'creator') return 'primary'
  return 'secondary'
}

const getButtonTextClass = (tier: PricingTierConfig): string =>
  tier.key === 'creator'
    ? 'font-inter text-sm font-bold leading-normal text-background'
    : 'font-inter text-sm font-bold leading-normal text-foreground'

const getPrice = (tier: PricingTierConfig): number =>
  tier.pricing[currentBillingCycle.value]

const getAnnualTotal = (tier: PricingTierConfig): number =>
  tier.pricing.yearly * 12

const isYearly = computed(() => currentBillingCycle.value === 'yearly')

const getCreditsDisplay = (tier: PricingTierConfig): number =>
  amountForBillingCycle(tier.pricing.credits, isYearly.value)

const getVideoEstimateDisplay = (tier: PricingTierConfig): number =>
  amountForBillingCycle(tier.pricing.videoEstimate, isYearly.value)

const handleSubscribe = wrapWithErrorHandlingAsync(
  async (tierKey: CheckoutTierKey) => {
    if (!isCloud || isLoading.value || isCurrentPlan(tierKey)) return

    isLoading.value = true
    loadingTier.value = tierKey
    const checkoutOwnerId = userId.value ?? undefined
    const checkoutWorkspaceId = workspaceStore.activeWorkspaceId

    try {
      if (hasPaidSubscription.value) {
        const targetPlan = {
          tierKey,
          billingCycle: currentBillingCycle.value
        } as const
        const previousPlan = currentPlanDescriptor.value
        const checkoutAttribution = await getCheckoutAttributionForCloud()
        const beginCheckoutMetadata = checkoutOwnerId
          ? {
              user_id: checkoutOwnerId,
              tier: targetPlan.tierKey,
              cycle: targetPlan.billingCycle,
              checkout_type: 'change' as const,
              ...(reason ? { payment_intent_source: reason } : {}),
              ...checkoutAttribution,
              ...(previousPlan ? { previous_tier: previousPlan.tierKey } : {})
            }
          : null
        // Pass the target tier to create a deep link to subscription update confirmation
        const checkoutTier = getCheckoutTier(
          targetPlan.tierKey,
          targetPlan.billingCycle
        )
        const downgrade =
          previousPlan &&
          isPlanDowngrade({
            current: previousPlan,
            target: targetPlan
          })

        if (downgrade) {
          // TODO(COMFY-StripeProration): Remove once backend checkout creation mirrors portal proration ("change at billing end")
          const didOpenPortal = await accessBillingPortal()
          if (didOpenPortal && beginCheckoutMetadata) {
            telemetry?.trackBeginCheckout(beginCheckoutMetadata)
          }
        } else {
          await runReportedCheckoutAttempt(
            {
              tier: targetPlan.tierKey,
              cycle: targetPlan.billingCycle,
              checkout_type: 'change',
              owner_id: checkoutOwnerId,
              workspace_id: checkoutWorkspaceId,
              payment_intent_source: reason,
              ...(previousPlan
                ? {
                    previous_tier: previousPlan.tierKey,
                    previous_cycle: previousPlan.billingCycle
                  }
                : {})
            },
            async (pendingAttempt) => {
              if (!(await accessBillingPortalDirect(checkoutTier))) {
                throw new PaymentPopupBlockedError(
                  t('subscription.billingTabBlocked')
                )
              }
              persistPendingSubscriptionCheckoutAttempt(pendingAttempt)
              if (beginCheckoutMetadata) {
                telemetry?.trackBeginCheckout(
                  withPendingCheckoutAttemptId(
                    beginCheckoutMetadata,
                    pendingAttempt
                  )
                )
              }
            }
          )
        }
      } else {
        // Failure telemetry now lives in performSubscriptionCheckout itself.
        await performSubscriptionCheckout(tierKey, currentBillingCycle.value, {
          paymentIntentSource: reason
        })
      }
    } finally {
      isLoading.value = false
      loadingTier.value = null
    }
  },
  reportError
)
</script>
