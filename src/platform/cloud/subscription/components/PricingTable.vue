<template>
  <div class="relative flex flex-col">
    <!-- Close button -->
    <button
      class="absolute top-0 right-0 z-10 flex size-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted-foreground hover:text-base-foreground"
      :aria-label="t('g.close')"
      @click="emit('close')"
    >
      <i class="icon-[lucide--x] size-4" />
    </button>

    <!-- Title -->
    <h2
      class="m-0 py-6 text-center font-inter text-2xl font-semibold text-base-foreground"
    >
      {{ t('subscription.choosePlan') }}
    </h2>

    <!-- Tab bar -->
    <div class="flex items-center justify-center">
      <button
        :class="
          cn(
            'flex h-10 cursor-pointer items-center justify-center rounded-t-lg border-none bg-base-background px-4 py-2 text-sm font-bold',
            activeTab === 'personal'
              ? 'text-base-foreground'
              : 'text-muted-foreground opacity-50'
          )
        "
        @click="activeTab = 'personal'"
      >
        {{ t('subscription.forPersonal') }}
      </button>
      <button
        :class="
          cn(
            'flex h-10 cursor-pointer items-center justify-center rounded-t-lg border-none bg-base-background px-4 py-2 text-sm font-bold',
            activeTab === 'teams'
              ? 'text-base-foreground'
              : 'text-muted-foreground opacity-50'
          )
        "
        @click="activeTab = 'teams'"
      >
        {{ t('subscription.forTeams') }}
      </button>
    </div>

    <!-- Tab content: grid overlay keeps height stable across tab switches -->
    <div class="grid">
      <!-- Personal tab content -->
      <div
        :class="
          cn(
            'col-start-1 row-start-1 flex flex-col',
            activeTab !== 'personal' && 'invisible'
          )
        "
      >
        <div
          class="flex flex-1 flex-col items-center gap-6 rounded-2xl bg-base-background p-8"
        >
          <!-- Disclaimer -->
          <p class="m-0 text-center text-base text-muted-foreground">
            <i18n-t keypath="subscription.personalDisclaimer">
              <template #teamBold>
                <span
                  class="cursor-pointer text-base-foreground hover:text-muted-foreground"
                  role="button"
                  tabindex="0"
                  @click="activeTab = 'teams'"
                  @keydown.enter="activeTab = 'teams'"
                >
                  {{ t('subscription.personalDisclaimerTeam') }}
                </span>
              </template>
            </i18n-t>
          </p>

          <!-- Billing toggle -->
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
                    'w-36 h-8 rounded-md transition-colors cursor-pointer border-none outline-none ring-0 text-sm font-medium flex items-center justify-center',
                    context.active
                      ? 'bg-base-foreground text-base-background'
                      : 'bg-transparent text-muted-foreground hover:bg-secondary-background-hover'
                  ]
                }),
                label: { class: 'flex items-center gap-2' }
              }
            }"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <span>{{ option.label }}</span>
                <div
                  v-if="option.value === 'yearly'"
                  class="flex items-center rounded-full bg-primary-background px-1 py-0.5 text-2xs font-bold text-white"
                >
                  {{ t('subscription.teamPlan.save', { percent: 20 }) }}
                </div>
              </div>
            </template>
          </SelectButton>

          <!-- 4 Tier Cards -->
          <div class="flex flex-col items-stretch gap-6 lg:flex-row">
            <div
              v-for="tier in tiers"
              :key="tier.id"
              :class="
                cn(
                  'flex flex-1 flex-col overflow-clip rounded-2xl border bg-base-background shadow-md',
                  tier.isPopular
                    ? 'border-muted-foreground'
                    : 'border-border-default'
                )
              "
            >
              <!-- Body -->
              <div class="flex flex-1 flex-col gap-6 p-8">
                <!-- Plan name + badge -->
                <div class="flex items-center justify-between">
                  <span
                    class="font-inter text-base/normal font-bold text-base-foreground"
                  >
                    {{ tier.name }}
                  </span>
                  <div
                    v-if="tier.isPopular"
                    class="flex h-4 items-center rounded-full bg-base-foreground px-1 text-2xs font-bold tracking-tight text-base-background uppercase"
                  >
                    {{ t('subscription.mostPopular') }}
                  </div>
                </div>

                <!-- Price -->
                <div class="flex flex-col gap-2">
                  <p class="m-0 mb-1 flex items-baseline text-base-foreground">
                    <span class="text-[32px] leading-none font-semibold">
                      ${{ getPrice(tier) }}
                    </span>
                    <span class="text-base font-normal">
                      &nbsp;{{ t('subscription.usdPerMonth') }}
                    </span>
                  </p>

                  <!-- Credits -->
                  <div class="flex items-center gap-1">
                    <i
                      class="icon-[lucide--component] size-4 text-amber-400"
                      aria-hidden="true"
                    />
                    <span
                      class="font-inter text-base/normal font-bold text-base-foreground"
                    >
                      {{ n(tier.pricing.credits) }}
                    </span>
                    <span class="text-sm text-base-foreground">
                      {{ t('subscription.teamPlan.monthlyCredits') }}
                    </span>
                  </div>

                  <!-- Billed text (invisible for free tier to keep dividers aligned) -->
                  <div class="flex items-center pt-1">
                    <span
                      :class="
                        cn(
                          'text-sm text-muted-foreground',
                          tier.key === 'free' && 'invisible'
                        )
                      "
                    >
                      {{
                        tier.key === 'free'
                          ? '\u00A0'
                          : currentBillingCycle === 'yearly'
                            ? t('subscription.billedYearly', {
                                total: `$${getAnnualTotal(tier)}`
                              })
                            : t('subscription.billedMonthly')
                      }}
                    </span>
                  </div>
                </div>

                <!-- Video estimate -->
                <div class="flex items-center gap-2">
                  <span class="text-sm text-muted-foreground">
                    {{
                      t('subscription.freeVideoEstimate', {
                        count: n(tier.pricing.videoEstimate)
                      })
                    }}
                  </span>
                </div>

                <!-- Divider -->
                <div class="border-t border-border-default" />

                <!-- Features -->
                <div class="flex flex-col gap-4">
                  <span
                    :class="
                      cn(
                        'text-sm text-muted-foreground',
                        !tier.inheritsFrom && 'invisible'
                      )
                    "
                  >
                    {{
                      t('subscription.everythingInPlus', {
                        tier: tier.inheritsFrom ?? tier.name
                      })
                    }}
                  </span>
                  <div
                    v-for="feature in tier.features"
                    :key="feature"
                    class="flex items-center gap-2"
                  >
                    <i
                      class="icon-[lucide--check] size-4 shrink-0 text-base-foreground"
                      aria-hidden="true"
                    />
                    <span class="text-sm text-base-foreground">
                      {{ feature }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Subscribe button -->
              <div class="p-8">
                <Button
                  size="lg"
                  :variant="tier.isPopular ? 'inverted' : 'secondary'"
                  :disabled="isLoading || isCurrentPlan(tier.key)"
                  :loading="loadingTier === tier.key"
                  class="w-full font-bold"
                  @click="handleSubscribe(tier.key)"
                >
                  {{ getButtonLabel(tier) }}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer disclaimer (personal tab) -->
        <div
          class="flex items-start gap-4 pt-4 pb-2 text-sm text-muted-foreground"
        >
          <p class="m-0">
            <i18n-t keypath="subscription.teamPlan.videoDisclaimer">
              <template #details>
                <button
                  class="cursor-pointer border-none bg-transparent p-0 font-inter text-sm text-base-foreground no-underline hover:text-muted-foreground"
                  @click="togglePopover"
                >
                  {{ t('subscription.teamPlan.clickForDetails') }}
                </button>
              </template>
            </i18n-t>
          </p>
          <p class="m-0">
            <i18n-t keypath="subscription.teamPlan.contactFooter">
              <template #questions>
                <a
                  href="https://www.comfy.org/discord"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-base-foreground no-underline hover:text-muted-foreground"
                >
                  {{ t('subscription.teamPlan.questions') }}
                </a>
              </template>
              <template #enterprise>
                <a
                  href="https://www.comfy.org/enterprise"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-base-foreground no-underline hover:text-muted-foreground"
                >
                  {{ t('subscription.teamPlan.enterpriseDiscussions') }}
                </a>
              </template>
              <template #pricing>
                <a
                  href="https://www.comfy.org/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-base-foreground no-underline hover:text-muted-foreground"
                >
                  {{ t('subscription.teamPlan.clickHere') }}
                </a>
              </template>
            </i18n-t>
          </p>
        </div>
      </div>

      <!-- Teams tab content -->
      <TeamPlanLayout
        :class="
          cn('col-start-1 row-start-1', activeTab !== 'teams' && 'invisible')
        "
        :is-loading="isLoading"
        :loading-tier="loadingTier"
        :subscribe-button-label="t('subscription.teamPlan.subscribeAndCreate')"
        @subscribe="handleTeamSubscribe"
        @contact-us="handleContactUs"
      />
    </div>

    <!-- Video Estimate Help Popover -->
    <Popover
      ref="popover"
      append-to="body"
      :auto-z-index="true"
      :base-z-index="1000"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="{
        root: {
          class:
            'rounded-lg border border-border-default bg-base-background shadow-lg p-4 max-w-xs'
        }
      }"
    >
      <div class="flex flex-col gap-2">
        <p class="m-0 text-sm/normal text-base-foreground">
          {{ t('subscription.videoEstimateExplanation') }}
        </p>
        <a
          href="https://cloud.comfy.org/?template=video_wan2_2_14B_i2v"
          target="_blank"
          rel="noopener noreferrer"
          class="flex gap-1 text-sm text-azure-600 no-underline hover:text-azure-400"
        >
          <span>{{ t('subscription.videoEstimateTryTemplate') }}</span>
          <span v-html="'&rarr;'"></span>
        </a>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import type { ToggleButtonPassThroughMethodOptions } from 'primevue/togglebutton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import {
  TIER_PRICING,
  TIER_TO_KEY
} from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  SubscriptionTier,
  TierKey,
  TierPricing
} from '@/platform/cloud/subscription/constants/tierPricing'
import { recordPendingSubscriptionCheckoutAttempt } from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { performSubscriptionCheckout } from '@/platform/cloud/subscription/utils/subscriptionCheckoutUtil'
import { isPlanDowngrade } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { CheckoutAttributionMetadata } from '@/platform/telemetry/types'
import { useAuthStore } from '@/stores/authStore'
import TeamPlanLayout from '@/platform/cloud/subscription/components/TeamPlanLayout.vue'

type CheckoutTierKey = Exclude<TierKey, 'free' | 'founder'>
type CheckoutTier = CheckoutTierKey | `${CheckoutTierKey}-yearly`

const FREE_TIER_CREDITS = 400
const FREE_TIER_VIDEO_ESTIMATE = 35

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
  id: SubscriptionTier | 'FREE'
  key: TierKey
  name: string
  pricing: TierPricing
  features: string[]
  inheritsFrom?: string
  isPopular?: boolean
}

const { defaultTab = 'personal' } = defineProps<{
  defaultTab?: 'personal' | 'teams'
}>()

const emit = defineEmits<{
  chooseTeamWorkspace: []
  close: []
}>()

const { t, n } = useI18n()

const activeTab = ref<'personal' | 'teams'>(defaultTab)

const billingCycleOptions: BillingCycleOption[] = [
  { label: t('subscription.yearly'), value: 'yearly' },
  { label: t('subscription.monthly'), value: 'monthly' }
]

const tiers: PricingTierConfig[] = [
  {
    id: 'FREE',
    key: 'free',
    name: t('subscription.tiers.free.name'),
    pricing: {
      monthly: 0,
      yearly: 0,
      credits: FREE_TIER_CREDITS,
      videoEstimate: FREE_TIER_VIDEO_ESTIMATE
    },
    features: [t('subscription.freeTierMaxRuntime')],
    isPopular: false
  },
  {
    id: 'STANDARD',
    key: 'standard',
    name: t('subscription.tiers.standard.name'),
    pricing: TIER_PRICING.standard,
    features: [
      t('subscription.standardMaxRuntime'),
      t('subscription.addMoreCreditsAnytime')
    ],
    inheritsFrom: t('subscription.tiers.free.name'),
    isPopular: false
  },
  {
    id: 'CREATOR',
    key: 'creator',
    name: t('subscription.tiers.creator.name'),
    pricing: TIER_PRICING.creator,
    features: [
      t('subscription.importOwnLoRAs'),
      t('subscription.addMoreCreditsAnytime')
    ],
    inheritsFrom: t('subscription.tiers.standard.name'),
    isPopular: true
  },
  {
    id: 'PRO',
    key: 'pro',
    name: t('subscription.tiers.pro.name'),
    pricing: TIER_PRICING.pro,
    features: [t('subscription.proMaxRuntimeLong')],
    inheritsFrom: t('subscription.tiers.creator.name'),
    isPopular: false
  }
]
const {
  isActiveSubscription,
  isFreeTier,
  subscriptionTier,
  isYearlySubscription
} = useSubscription()
const telemetry = useTelemetry()
const { userId } = storeToRefs(useAuthStore())
const { accessBillingPortal, reportError } = useAuthActions()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const isLoading = ref(false)
const loadingTier = ref<CheckoutTierKey | null>(null)
const popover = ref()
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

function isCurrentPlan(tierKey: TierKey): boolean {
  if (!currentTierKey.value) return false

  if (tierKey === 'free') return isFreeTier.value

  const selectedIsYearly = currentBillingCycle.value === 'yearly'

  return (
    currentTierKey.value === tierKey &&
    isYearlySubscription.value === selectedIsYearly
  )
}

function getButtonLabel(tier: PricingTierConfig): string {
  if (isCurrentPlan(tier.key)) return t('subscription.currentPlan')

  const planName =
    currentBillingCycle.value === 'yearly' && tier.key !== 'free'
      ? t('subscription.tierNameYearly', { name: tier.name })
      : tier.name

  return hasPaidSubscription.value
    ? t('subscription.changeTo', { plan: planName })
    : t('subscription.subscribeTo', { plan: planName })
}

function getPrice(tier: PricingTierConfig): number {
  if (tier.key === 'free') return 0
  return tier.pricing[currentBillingCycle.value]
}

function getAnnualTotal(tier: PricingTierConfig): number {
  return tier.pricing.yearly * 12
}

function togglePopover(event: Event) {
  popover.value.toggle(event)
}

function handleContactUs() {
  window.open('https://www.comfy.org/discord', '_blank')
}

function handleTeamSubscribe() {
  emit('chooseTeamWorkspace')
}

const handleSubscribe = wrapWithErrorHandlingAsync(async (tierKey: TierKey) => {
  if (!isCloud || isLoading.value || isCurrentPlan(tierKey)) return
  if (tierKey === 'free') return

  const checkoutTierKey = tierKey as CheckoutTierKey

  isLoading.value = true
  loadingTier.value = checkoutTierKey

  try {
    if (hasPaidSubscription.value) {
      const targetPlan = {
        tierKey: checkoutTierKey,
        billingCycle: currentBillingCycle.value
      } as const
      const previousPlan = currentPlanDescriptor.value
      const checkoutAttribution = await getCheckoutAttributionForCloud()
      if (userId.value) {
        telemetry?.trackBeginCheckout({
          user_id: userId.value,
          tier: targetPlan.tierKey,
          cycle: targetPlan.billingCycle,
          checkout_type: 'change',
          ...checkoutAttribution,
          ...(previousPlan ? { previous_tier: previousPlan.tierKey } : {})
        })
      }
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
        await accessBillingPortal()
      } else {
        const didOpenPortal = await accessBillingPortal(checkoutTier)
        if (!didOpenPortal) {
          return
        }

        recordPendingSubscriptionCheckoutAttempt({
          tier: targetPlan.tierKey,
          cycle: targetPlan.billingCycle,
          checkout_type: 'change',
          ...(previousPlan ? { previous_tier: previousPlan.tierKey } : {}),
          ...(previousPlan ? { previous_cycle: previousPlan.billingCycle } : {})
        })
      }
    } else {
      await performSubscriptionCheckout(
        checkoutTierKey,
        currentBillingCycle.value,
        true
      )
    }
  } finally {
    isLoading.value = false
    loadingTier.value = null
  }
}, reportError)
</script>
