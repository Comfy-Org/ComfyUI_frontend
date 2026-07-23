<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-center">
      <SelectButton
        v-model="currentBillingCycle"
        :options="billingCycleOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        unstyled
        :pt="{
          root: {
            class: 'flex gap-1 bg-secondary-background rounded-lg p-1.5'
          },
          pcToggleButton: {
            root: ({ context }: ToggleButtonPassThroughMethodOptions) => ({
              class: [
                'w-36  h-8 rounded-md transition-colors cursor-pointer border-none outline-none ring-0 text-sm font-medium flex items-center justify-center',
                context.active
                  ? 'bg-base-foreground text-base-background'
                  : 'bg-transparent text-muted-foreground hover:bg-secondary-background-hover'
              ]
            }),
            label: { class: 'flex items-center gap-2 ' }
          }
        }"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <span>{{ option.label }}</span>
            <div
              v-if="option.value === 'yearly'"
              class="flex items-center rounded-full bg-primary-background px-2 py-0.5 text-2xs font-bold whitespace-nowrap text-white"
            >
              {{ t('subscription.saveYearly') }}
            </div>
          </div>
        </template>
      </SelectButton>
    </div>
    <div class="flex flex-col items-stretch gap-4 xl:flex-row">
      <div
        v-for="tier in tiers"
        :key="tier.id"
        :class="
          cn(
            'flex flex-1 flex-col rounded-2xl border border-border-default bg-base-background shadow-[0_0_12px_rgba(0,0,0,0.1)]',
            tier.isPopular ? 'border-muted-foreground' : ''
          )
        "
      >
        <div class="flex flex-col gap-4 p-6 pb-0">
          <div class="flex flex-row items-center justify-between gap-2">
            <span
              class="font-inter text-base/normal font-bold text-base-foreground"
            >
              {{ tier.name }}
            </span>
            <div
              v-if="tier.isPopular"
              class="flex h-5 items-center rounded-full bg-base-foreground px-1.5 text-2xs font-bold tracking-tight text-base-background uppercase"
            >
              {{ t('subscription.mostPopular') }}
            </div>
          </div>
          <div class="flex flex-col">
            <div class="flex flex-col gap-2">
              <div class="flex flex-row items-baseline gap-2">
                <span
                  class="font-inter text-[28px] leading-normal font-semibold text-base-foreground tabular-nums"
                >
                  ${{ getPrice(tier) }}
                  <span
                    v-show="currentBillingCycle === 'yearly'"
                    class="text-2xl text-muted-foreground line-through"
                  >
                    ${{ tier.pricing.monthly }}
                  </span>
                </span>
                <span class="font-inter text-xl/normal text-base-foreground">
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
            <span class="mx-1 text-muted-foreground">–</span>
            <button
              class="text-primary-foreground cursor-pointer border-none bg-transparent p-0 text-sm font-medium underline hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
              @click="emit('chooseTeamWorkspace')"
            >
              {{ t('subscription.needTeamWorkspace') }}
            </button>
          </p>

          <div class="flex flex-1 flex-col gap-3 pb-0">
            <div class="flex flex-row items-center justify-between">
              <span
                class="text-foreground font-inter text-sm/normal font-normal"
              >
                {{
                  currentBillingCycle === 'yearly'
                    ? t('subscription.yearlyCreditsLabel')
                    : t('subscription.monthlyCreditsLabel')
                }}
              </span>
              <div class="flex flex-row items-center gap-1">
                <i
                  class="icon-[comfy--credits] size-4 shrink-0 bg-amber-400"
                  aria-hidden="true"
                />
                <span
                  class="font-inter text-sm/normal font-bold text-base-foreground tabular-nums"
                >
                  {{ n(getCreditsDisplay(tier)) }}
                </span>
              </div>
            </div>

            <div class="flex flex-row items-center justify-between">
              <span class="text-foreground text-sm font-normal">
                {{ t('subscription.maxDurationLabel') }}
              </span>
              <span
                class="font-inter text-sm/normal font-bold text-base-foreground tabular-nums"
              >
                {{ tier.maxDuration }}
              </span>
            </div>

            <div class="flex flex-row items-center justify-between">
              <span class="text-foreground text-sm font-normal">
                {{ t('subscription.gpuLabel') }}
              </span>
              <i class="pi pi-check text-success-foreground text-xs" />
            </div>

            <div class="flex flex-row items-center justify-between">
              <span class="text-foreground text-sm font-normal">
                {{ t('subscription.addCreditsLabel') }}
              </span>
              <i class="pi pi-check text-success-foreground text-xs" />
            </div>

            <div class="flex flex-row items-center justify-between">
              <span class="text-foreground text-sm font-normal">
                {{ t('subscription.customLoRAsLabel') }}
              </span>
              <i
                v-if="tier.customLoRAs"
                class="pi pi-check text-success-foreground text-xs"
              />
              <i v-else class="pi pi-times text-foreground text-xs" />
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex flex-row items-start justify-between">
                <div class="flex flex-col gap-2">
                  <span class="text-foreground text-sm/relaxed font-normal">
                    {{ t('subscription.videoEstimateLabel') }}
                  </span>
                  <Popover>
                    <PopoverTrigger as-child>
                      <button
                        type="button"
                        class="focus-visible:ring-secondary-foreground group flex cursor-pointer flex-row items-center gap-2 rounded-sm pt-2 text-left focus-visible:ring-1 focus-visible:outline-none"
                      >
                        <i
                          class="pi pi-question-circle text-xs text-muted-foreground group-hover:text-base-foreground"
                          aria-hidden="true"
                        />
                        <span
                          class="text-sm font-normal text-muted-foreground group-hover:text-base-foreground"
                        >
                          {{ t('subscription.videoEstimateHelp') }}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      class="z-1800 w-auto max-w-xs rounded-lg border border-interface-stroke bg-interface-panel-surface p-4 shadow-lg"
                    >
                      <div class="flex flex-col gap-2">
                        <p class="text-sm/normal text-base-foreground">
                          {{ t('subscription.videoEstimateExplanation') }}
                        </p>
                        <a
                          href="https://cloud.comfy.org/?template=video_wan2_2_14B_i2v"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-base-foreground"
                        >
                          <span class="underline">
                            {{ t('subscription.videoEstimateTryTemplate') }}
                          </span>
                          <span class="no-underline" aria-hidden="true">→</span>
                        </a>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <span
                  class="font-inter text-sm/normal font-bold text-base-foreground tabular-nums"
                >
                  ~{{ n(tier.pricing.videoEstimate) }}
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
                  ? 'border-transparent bg-base-foreground hover:bg-inverted-background-hover'
                  : 'border-transparent bg-secondary-background hover:bg-secondary-background-hover focus:bg-secondary-background-selected'
              )
            "
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
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import SelectButton from 'primevue/selectbutton'
import type { ToggleButtonPassThroughMethodOptions } from 'primevue/togglebutton'
import { PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import {
  TIER_PRICING,
  TIER_TO_KEY
} from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  SubscriptionTier,
  TierKey,
  TierPricing
} from '@/platform/cloud/subscription/constants/tierPricing'
import {
  recordPendingSubscriptionCheckoutAttempt,
  withPendingCheckoutAttemptId
} from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { performSubscriptionCheckout } from '@/platform/cloud/subscription/utils/subscriptionCheckoutUtil'
import { isPlanDowngrade } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type {
  CheckoutAttributionMetadata,
  PaymentIntentSource
} from '@/platform/telemetry/types'
import { useAuthStore } from '@/stores/authStore'

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
  id: SubscriptionTier
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
  isActiveSubscription,
  isFreeTier,
  tier: subscriptionTier,
  subscription
} = useBillingContext()

const isYearlySubscription = computed(
  () => subscription.value?.duration === 'ANNUAL'
)
const telemetry = useTelemetry()
const { userId } = storeToRefs(useAuthStore())
const { accessBillingPortal, reportError } = useAuthActions()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const isLoading = ref(false)
const loadingTier = ref<CheckoutTierKey | null>(null)
const currentBillingCycle = ref<BillingCycle>('yearly')

const hasPaidSubscription = computed(
  () => isActiveSubscription.value && !isFreeTier.value
)

const currentTierKey = computed<TierKey | null>(() =>
  subscriptionTier.value ? TIER_TO_KEY[subscriptionTier.value] : null
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
    ? 'font-inter text-sm font-bold leading-normal text-base-background'
    : 'font-inter text-sm font-bold leading-normal text-primary-foreground'

const getPrice = (tier: PricingTierConfig): number =>
  tier.pricing[currentBillingCycle.value]

const getAnnualTotal = (tier: PricingTierConfig): number =>
  tier.pricing.yearly * 12

const getCreditsDisplay = (tier: PricingTierConfig): number =>
  tier.pricing.credits * (currentBillingCycle.value === 'yearly' ? 12 : 1)

const handleSubscribe = wrapWithErrorHandlingAsync(
  async (tierKey: CheckoutTierKey) => {
    if (!isCloud || isLoading.value || isCurrentPlan(tierKey)) return

    isLoading.value = true
    loadingTier.value = tierKey

    try {
      if (hasPaidSubscription.value) {
        const targetPlan = {
          tierKey,
          billingCycle: currentBillingCycle.value
        } as const
        const previousPlan = currentPlanDescriptor.value
        const checkoutAttribution = await getCheckoutAttributionForCloud()
        const beginCheckoutMetadata = userId.value
          ? {
              user_id: userId.value,
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
          const didOpenPortal = await accessBillingPortal(checkoutTier)
          if (!didOpenPortal) {
            return
          }

          const pendingAttempt = recordPendingSubscriptionCheckoutAttempt({
            tier: targetPlan.tierKey,
            cycle: targetPlan.billingCycle,
            checkout_type: 'change',
            payment_intent_source: reason,
            ...(previousPlan ? { previous_tier: previousPlan.tierKey } : {}),
            ...(previousPlan
              ? { previous_cycle: previousPlan.billingCycle }
              : {})
          })
          if (beginCheckoutMetadata) {
            telemetry?.trackBeginCheckout(
              withPendingCheckoutAttemptId(
                beginCheckoutMetadata,
                pendingAttempt
              )
            )
          }
        }
      } else {
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
