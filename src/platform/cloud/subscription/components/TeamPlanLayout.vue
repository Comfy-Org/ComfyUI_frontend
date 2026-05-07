<template>
  <div class="flex w-full flex-1 flex-col items-center gap-6">
    <!-- Subtitle -->
    <p class="m-0 text-center text-base text-muted-foreground">
      <i18n-t keypath="subscription.teamPlanSubtitle">
        <template #learnMore>
          <a
            href="https://www.comfy.org/cloud/enterprise"
            target="_blank"
            rel="noopener noreferrer"
            class="text-base-foreground no-underline hover:text-muted-foreground"
          >
            {{ t('subscription.teamPlanLearnMore') }}
          </a>
        </template>
      </i18n-t>
    </p>

    <!-- Billing cycle toggle -->
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
              'min-w-[167px] h-8 rounded-md transition-colors cursor-pointer border-none outline-none ring-0 text-sm font-medium flex items-center justify-center px-4',
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
            {{ t('subscription.teamPlan.saveUpTo', { percent: 20 }) }}
          </div>
        </div>
      </template>
    </SelectButton>

    <!-- Three-panel layout -->
    <!-- 4 × 320px + 3 × 24px gap = 1352px matches personal tab width -->
    <div class="flex flex-1 flex-col gap-6 xl:max-w-[1352px] xl:flex-row">
      <!-- Merged Team Plan + Details card -->
      <div
        class="flex overflow-clip rounded-2xl border border-border-default shadow-md"
      >
        <!-- Left: Team Plan -->
        <div class="flex w-full flex-1 flex-col bg-base-background">
          <!-- Body -->
          <div class="flex flex-1 flex-col gap-6 p-8">
            <div class="flex flex-col gap-2">
              <h3 class="m-0 text-base font-bold text-base-foreground">
                {{ t('subscription.teamPlan.title') }}
              </h3>
              <p class="m-0 text-sm leading-[20px] text-muted-foreground">
                {{ t('subscription.teamPlan.chooseCreditsDescription') }}
              </p>
            </div>

            <!-- Amount section: price + billed + slider (flex-1 pushes credit details down) -->
            <div class="flex flex-1 flex-col gap-2">
              <div class="flex min-h-[40px] items-baseline gap-2">
                <p
                  class="m-0 flex shrink-0 items-baseline whitespace-nowrap text-base-foreground tabular-nums"
                >
                  <span class="text-[32px] leading-none font-semibold">
                    ${{ displayPrice }}
                  </span>
                  <span
                    v-if="originalPrice !== currentPrice"
                    class="ml-1 text-base font-normal text-muted-foreground line-through"
                  >
                    ${{ originalPrice }}
                  </span>
                  <span class="text-base font-normal">
                    &nbsp;{{ t('subscription.usdPerMonth') }}
                  </span>
                </p>
                <div
                  v-if="savingPercent > 0"
                  class="ml-auto shrink-0 rounded-full border-2 border-primary-background px-2 py-1 text-sm font-bold whitespace-nowrap text-primary-background tabular-nums"
                >
                  {{
                    t('subscription.teamPlan.savingOnCredits', {
                      percent: savingPercent,
                      amount: savingAmount
                    })
                  }}
                </div>
              </div>

              <span class="text-sm text-muted-foreground">
                {{
                  currentBillingCycle === 'yearly'
                    ? t('subscription.teamPlan.billedYearlyAmount', {
                        amount: n(displayPrice * 12)
                      })
                    : t('subscription.billedMonthly')
                }}
              </span>

              <!-- Slider -->
              <div class="flex flex-col pt-6">
                <div class="relative py-3">
                  <Slider
                    :model-value="[sliderValue]"
                    :min="SLIDER_MIN"
                    :max="SLIDER_MAX"
                    :step="SLIDER_STEP"
                    class="w-full **:data-[slot=slider-range]:bg-base-foreground **:data-[slot=slider-thumb]:bg-base-foreground **:data-[slot=slider-thumb]:ring-base-foreground"
                    @update:model-value="onSliderChange"
                  />
                  <!-- Pop-up discount badges -->
                  <div
                    v-for="badge in popBadges"
                    :key="badge.id"
                    class="pointer-events-none absolute -translate-x-1/2 rounded-full border-2 border-primary-background px-1.5 py-0.5 text-2xs font-bold whitespace-nowrap text-primary-background transition-all duration-300 ease-out"
                    :class="
                      badge.phase === 'enter'
                        ? 'scale-110 opacity-100'
                        : 'scale-75 opacity-0'
                    "
                    :style="{
                      left: `${badge.position}%`,
                      bottom: 'calc(50% + 12px)'
                    }"
                  >
                    {{ badge.percent }}%
                  </div>
                  <!-- Tick marks -->
                  <div
                    v-for="pos in SLIDER_DOT_POSITIONS"
                    :key="pos"
                    :class="
                      cn(
                        'absolute top-1/2 size-1 -translate-1/2 rounded-full',
                        sliderValue >= pos
                          ? 'bg-base-foreground'
                          : 'bg-muted-foreground/40'
                      )
                    "
                    :style="{
                      left: `${((pos - SLIDER_MIN) / SLIDER_RANGE) * 100}%`
                    }"
                  />
                </div>
                <div class="relative flex h-4 items-start">
                  <div
                    v-for="(label, index) in sliderCreditLabels"
                    :key="index"
                    class="absolute flex items-center gap-1"
                    :class="
                      cn(
                        index === 0 && 'left-0',
                        index === sliderCreditLabels.length - 1 && 'right-0',
                        index > 0 &&
                          index < sliderCreditLabels.length - 1 &&
                          '-translate-x-1/2'
                      )
                    "
                    :style="
                      index > 0 && index < sliderCreditLabels.length - 1
                        ? {
                            left: `${((SLIDER_LABEL_POSITIONS[index] - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%`
                          }
                        : undefined
                    "
                  >
                    <i
                      :class="
                        cn(
                          'icon-[lucide--component] size-4 transition-colors',
                          sliderValue >= SLIDER_LABEL_POSITIONS[index]
                            ? 'text-amber-400'
                            : 'text-muted-foreground'
                        )
                      "
                      aria-hidden="true"
                    />
                    <span
                      :class="
                        cn(
                          'text-sm font-bold transition-colors',
                          sliderValue >= SLIDER_LABEL_POSITIONS[index]
                            ? 'text-base-foreground'
                            : 'text-muted-foreground'
                        )
                      "
                    >
                      {{ label }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Credit details (bottom of body) -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-1">
                <i
                  class="icon-[lucide--component] size-4 text-amber-400"
                  aria-hidden="true"
                />
                <span
                  class="font-inter text-base/normal font-bold text-base-foreground"
                >
                  {{ n(currentCredits) }}
                </span>
                <span class="text-sm text-base-foreground">
                  {{ t('subscription.teamPlan.monthlyCredits') }}
                </span>
              </div>
              <span class="text-sm text-muted-foreground">
                {{
                  t('subscription.teamPlan.generatesVideos', {
                    count: n(videoEstimate)
                  })
                }}
              </span>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-8 pb-8">
            <Button
              size="lg"
              variant="inverted"
              :disabled="isLoading || isCurrentPlanSelected"
              :loading="loadingTier !== null"
              class="w-full font-bold"
              @click="handleSubscribe"
            >
              {{
                isCurrentPlanSelected
                  ? t('subscription.currentPlan')
                  : resolvedButtonLabel
              }}
            </Button>
          </div>
        </div>

        <!-- Vertical divider -->
        <div class="flex items-stretch py-8">
          <div class="w-px bg-border-default" />
        </div>

        <!-- Right: Details -->
        <div
          class="flex w-full flex-col bg-base-background xl:w-[384px] xl:shrink-0"
        >
          <div class="flex flex-col gap-6 p-8">
            <h3 class="m-0 text-base font-bold text-base-foreground">
              {{ t('subscription.teamPlan.details') }}
            </h3>

            <!-- Inherits from Pro -->
            <span class="text-sm text-muted-foreground">
              <i18n-t keypath="subscription.everythingInPlus">
                <template #tier>
                  <button
                    class="cursor-pointer border-none bg-transparent p-0 font-inter text-sm font-bold text-base-foreground hover:text-muted-foreground"
                    @click="emit('switchToPersonal')"
                  >
                    {{ t('subscription.tiers.pro.name') }}
                  </button>
                </template>
              </i18n-t>
            </span>

            <!-- Feature list -->
            <div class="flex flex-col gap-4">
              <div
                v-for="feature in teamFeatures"
                :key="feature"
                class="flex items-center gap-2"
              >
                <i
                  class="icon-[lucide--check] size-4 shrink-0 text-base-foreground"
                  aria-hidden="true"
                />
                <span class="text-sm text-base-foreground">{{ feature }}</span>
              </div>
            </div>

            <!-- Coming soon -->
            <div class="flex flex-col gap-4">
              <span class="text-sm text-muted-foreground">
                {{ t('subscription.teamPlan.comingSoon') }}
              </span>
              <div class="flex items-center gap-2">
                <i
                  class="icon-[lucide--clock] size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span class="text-sm text-muted-foreground">
                  {{ t('subscription.teamPlan.projectManagement') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Enterprise card -->
      <div
        class="flex w-full flex-col self-stretch overflow-clip rounded-2xl border border-border-default bg-base-background shadow-md xl:w-[320px] xl:shrink-0"
      >
        <div class="flex flex-1 flex-col gap-6 p-8">
          <h3 class="m-0 text-base font-bold text-base-foreground">
            {{ t('subscription.teamPlan.enterprise.title') }}
          </h3>

          <div class="flex flex-col gap-4 text-sm text-muted-foreground">
            <p class="m-0">
              {{ t('subscription.teamPlan.enterprise.needMoreMembers') }}
            </p>
            <p class="m-0">
              {{ t('subscription.teamPlan.enterprise.customFeatures') }}
            </p>
          </div>

          <div class="h-px w-full bg-border-default" />

          <p class="m-0 text-sm text-muted-foreground">
            {{ t('subscription.teamPlan.enterprise.reachOut') }}
          </p>
        </div>

        <div class="px-8 pb-8">
          <a
            href="https://www.comfy.org/cloud/enterprise"
            target="_blank"
            rel="noopener noreferrer"
            class="no-underline"
          >
            <Button size="lg" variant="secondary" class="w-full font-bold">
              {{ t('subscription.teamPlanLearnMore') }}
            </Button>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import type { ToggleButtonPassThroughMethodOptions } from 'primevue/togglebutton'
import { TransitionPresets, useTransition } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import {
  TIER_PRICING,
  TIER_TO_KEY
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'

type CheckoutTierKey = Exclude<TierKey, 'free' | 'founder'>

const {
  isLoading = false,
  loadingTier = null,
  subscribeButtonLabel
} = defineProps<{
  isLoading?: boolean
  loadingTier?: CheckoutTierKey | null
  subscribeButtonLabel?: string
}>()

const emit = defineEmits<{
  subscribe: [payload: { tierKey: CheckoutTierKey; billingCycle: BillingCycle }]
  switchToPersonal: []
}>()

const { t, n } = useI18n()
const { subscription, fetchPlans } = useBillingContext()

// Slider constants
const SLIDER_MIN = 200
const SLIDER_MAX = 2000
const SLIDER_STEP = 50

// Credits per dollar at base rate (derived from Pro tier: 21,100 credits / $100)
const BASE_CREDITS_PER_DOLLAR =
  TIER_PRICING.pro.credits / TIER_PRICING.pro.monthly
// Video estimate ratio (derived from Pro tier)
const CREDITS_PER_VIDEO =
  TIER_PRICING.pro.credits / TIER_PRICING.pro.videoEstimate

// 5 dot positions at 0%, 25%, 50%, 75%, 100%
const SLIDER_RANGE = SLIDER_MAX - SLIDER_MIN
const SLIDER_DOT_POSITIONS = Array.from(
  { length: 5 },
  (_, i) => SLIDER_MIN + SLIDER_RANGE * (i / 4)
)

// Discount thresholds at 25%, 50%, 75%, 100% (yearly %; monthly = half)
const DISCOUNT_THRESHOLDS = [
  { min: SLIDER_DOT_POSITIONS[1], yearlyPercent: 5 },
  { min: SLIDER_DOT_POSITIONS[2], yearlyPercent: 10 },
  { min: SLIDER_DOT_POSITIONS[3], yearlyPercent: 15 },
  { min: SLIDER_DOT_POSITIONS[4], yearlyPercent: 20 }
]

const sliderValue = ref(SLIDER_MIN)
const currentBillingCycle = ref<BillingCycle>('yearly')

interface BillingCycleOption {
  label: string
  value: BillingCycle
}

const billingCycleOptions: BillingCycleOption[] = [
  { label: t('subscription.yearly'), value: 'yearly' },
  { label: t('subscription.monthly'), value: 'monthly' }
]

onMounted(() => {
  void fetchPlans()
})

/** Get the discount percentage based on threshold (floor value) */
function getDiscountPercent(price: number, cycle: BillingCycle): number {
  let percent = 0
  for (const threshold of DISCOUNT_THRESHOLDS) {
    if (price >= threshold.min) {
      percent = threshold.yearlyPercent
    }
  }
  return cycle === 'yearly' ? percent : percent / 2
}

const discountPercent = computed(() =>
  getDiscountPercent(sliderValue.value, currentBillingCycle.value)
)

const originalPrice = computed(() => sliderValue.value)

const currentPrice = computed(() => {
  if (discountPercent.value <= 0) return sliderValue.value
  return Math.round(sliderValue.value * (1 - discountPercent.value / 100))
})

const savingPercent = computed(() => discountPercent.value)

const savingAmount = computed(() => originalPrice.value - currentPrice.value)

// Animated number transitions for smooth counting effect
const TRANSITION_OPTIONS = {
  duration: 400,
  transition: TransitionPresets.easeOutCubic
} as const

const animatedPrice = useTransition(currentPrice, TRANSITION_OPTIONS)
const displayPrice = computed(() => Math.round(animatedPrice.value))

const currentCredits = computed(() =>
  Math.round(sliderValue.value * BASE_CREDITS_PER_DOLLAR)
)

const videoEstimate = computed(() =>
  Math.round(currentCredits.value / CREDITS_PER_VIDEO)
)

function formatCreditsLabel(price: number): string {
  const credits = price * BASE_CREDITS_PER_DOLLAR
  const k = credits / 1000
  return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`
}

// Label positions: min, midpoint, max
const SLIDER_LABEL_POSITIONS = [
  SLIDER_MIN,
  (SLIDER_MIN + SLIDER_MAX) / 2,
  SLIDER_MAX
]

const sliderCreditLabels = computed(() =>
  SLIDER_LABEL_POSITIONS.map(formatCreditsLabel)
)

// Pop-up discount badges above slider dots on threshold crossing
interface PopBadge {
  id: number
  percent: number
  position: number
  phase: 'pre' | 'enter' | 'exit'
}

let popBadgeId = 0
const popBadges = ref<PopBadge[]>([])

watch(discountPercent, async (newVal, oldVal) => {
  if (newVal > oldVal) {
    const threshold = DISCOUNT_THRESHOLDS.find(
      (t) => getDiscountPercent(t.min, currentBillingCycle.value) === newVal
    )
    if (!threshold) return

    const position = ((threshold.min - SLIDER_MIN) / SLIDER_RANGE) * 100
    const id = ++popBadgeId
    const badge: PopBadge = {
      id,
      percent:
        currentBillingCycle.value === 'yearly'
          ? threshold.yearlyPercent
          : threshold.yearlyPercent / 2,
      position,
      phase: 'pre'
    }
    popBadges.value.push(badge)

    // Trigger enter on next frame so CSS transition fires
    await nextTick()
    requestAnimationFrame(() => {
      const b = popBadges.value.find((b) => b.id === id)
      if (b) b.phase = 'enter'
    })

    // Start exit after hold
    setTimeout(() => {
      const b = popBadges.value.find((b) => b.id === id)
      if (b) b.phase = 'exit'
    }, 1000)

    // Remove after exit transition
    setTimeout(() => {
      popBadges.value = popBadges.value.filter((b) => b.id !== id)
    }, 1400)
  }
})

const currentTierKey = computed<TierKey | null>(() =>
  subscription.value?.tier ? TIER_TO_KEY[subscription.value.tier] : null
)

const isCurrentPlanSelected = computed(() => {
  return currentTierKey.value === 'pro' && !subscription.value?.isCancelled
})

const teamFeatures = computed(() => [
  t('subscription.teamInviteMembers', { count: 30 }),
  t('subscription.teamConcurrency'),
  t('subscription.teamPlan.sharedCreditPool'),
  t('subscription.teamPlan.roleBasedPermissions')
])

const resolvedButtonLabel = computed(() => {
  if (subscribeButtonLabel) return subscribeButtonLabel
  return currentBillingCycle.value === 'yearly'
    ? t('subscription.teamPlan.subscribeToTeamYearly')
    : t('subscription.teamPlan.subscribeToTeamMonthly')
})

function onSliderChange(values?: number[]) {
  if (values?.length) {
    sliderValue.value = values[0]
  }
}

function handleSubscribe() {
  if (isLoading) return

  emit('subscribe', {
    tierKey: 'pro',
    billingCycle: currentBillingCycle.value
  })
}
</script>
