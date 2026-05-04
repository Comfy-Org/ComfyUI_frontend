<template>
  <div class="flex flex-col">
    <!-- Inner content -->
    <div
      class="flex flex-1 flex-col items-center gap-6 rounded-2xl bg-base-background p-8"
    >
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

      <!-- Two-panel layout -->
      <div class="flex flex-1 flex-col gap-8 lg:flex-row">
        <!-- Left panel: Customize your plan -->
        <div
          class="flex w-full flex-col overflow-clip rounded-2xl border border-border-default bg-base-background shadow-md lg:max-w-[416px]"
        >
          <!-- Body -->
          <div class="flex flex-1 flex-col gap-6 p-8">
            <h3 class="m-0 text-base font-bold text-base-foreground">
              {{ t('subscription.teamPlan.customizeYourPlan') }}
            </h3>

            <!-- Amount section: price + credits + billed + slider -->
            <div class="flex flex-col gap-2">
              <p class="m-0 mb-1 flex items-baseline text-base-foreground">
                <span class="text-[32px] leading-none font-semibold">
                  ${{ currentPrice }}
                </span>
                <span class="text-base font-normal">
                  &nbsp;{{ t('subscription.usdPerMonth') }}
                </span>
              </p>

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

              <p class="m-0 pt-1 text-sm text-muted-foreground">
                {{
                  currentBillingCycle === 'yearly'
                    ? t('subscription.teamPlan.billedYearlyAmount', {
                        amount: n(currentPrice * 12)
                      })
                    : t('subscription.billedMonthly')
                }}
              </p>

              <!-- Slider -->
              <div class="flex flex-col pt-2">
                <div class="py-3">
                  <Slider
                    :model-value="[sliderValue]"
                    :min="SLIDER_MIN"
                    :max="SLIDER_MAX"
                    :step="SLIDER_STEP"
                    class="w-full"
                    @update:model-value="onSliderChange"
                  />
                </div>
                <div class="flex items-start justify-between">
                  <span class="text-sm text-muted-foreground">
                    ${{ SLIDER_MIN }}
                  </span>
                  <span class="text-center text-sm text-muted-foreground">
                    $1,000
                  </span>
                  <span class="text-sm text-muted-foreground">
                    ${{ n(SLIDER_MAX) }}
                  </span>
                </div>
                <div class="flex items-start justify-between pt-1">
                  <div class="w-[48px]" />
                  <span
                    class="rounded-full bg-secondary-background px-1.5 py-0.5 text-2xs font-bold text-base-foreground"
                  >
                    {{ t('subscription.teamPlan.save', { percent: 10 }) }}
                  </span>
                  <span
                    class="rounded-full bg-secondary-background px-1.5 py-0.5 text-2xs font-bold text-base-foreground"
                  >
                    {{ t('subscription.teamPlan.save', { percent: 20 }) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="flex flex-col gap-2">
              <p class="m-0 text-sm text-muted-foreground">
                {{
                  t('subscription.teamPlan.generatesVideos', {
                    count: n(videoEstimate)
                  })
                }}
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-8">
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

        <!-- Right panel: Plan details -->
        <div
          class="flex flex-1 flex-col overflow-clip rounded-2xl border border-border-default bg-base-background shadow-md"
        >
          <div class="flex flex-col gap-6 p-8">
            <h3 class="m-0 text-base font-bold text-base-foreground">
              {{ t('subscription.teamPlan.planDetails') }}
            </h3>

            <!-- Feature list -->
            <div class="flex flex-col gap-4">
              <div
                v-for="feature in features"
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

            <!-- Divider -->
            <div class="border-t border-border-default" />

            <!-- Member description -->
            <div
              class="flex flex-col gap-2 text-sm leading-[20px] text-muted-foreground"
            >
              <p class="m-0">
                {{ t('subscription.teamPlan.memberDescription') }}
              </p>
              <p class="m-0">
                {{ t('subscription.teamPlan.memberNeedMore') }}
                <button
                  class="cursor-pointer border-none bg-transparent p-0 font-inter text-sm font-medium text-base-foreground no-underline hover:text-muted-foreground"
                  @click="handleContactUs"
                >
                  {{ t('subscription.contactUs') }}.
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer disclaimer -->
    <div class="flex items-start gap-4 pt-4 pb-2 text-sm text-muted-foreground">
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
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import type { ToggleButtonPassThroughMethodOptions } from 'primevue/togglebutton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

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
  contactUs: []
}>()

const { t, n } = useI18n()
const { subscription, fetchPlans } = useBillingContext()

const popover = ref()

function togglePopover(event: Event) {
  popover.value.toggle(event)
}

// Slider constants
const SLIDER_MIN = 100
const SLIDER_MAX = 2000
const SLIDER_STEP = 100

// Credits per dollar at base rate (derived from Pro tier: 21,100 credits / $100)
const BASE_CREDITS_PER_DOLLAR =
  TIER_PRICING.pro.credits / TIER_PRICING.pro.monthly
// Video estimate ratio (derived from Pro tier)
const CREDITS_PER_VIDEO =
  TIER_PRICING.pro.credits / TIER_PRICING.pro.videoEstimate

const sliderValue = ref(290)
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

/** Discount multiplier based on slider position */
function getDiscountMultiplier(price: number): number {
  if (price >= 2000) return 1.2
  if (price >= 1000) return 1.0 + 0.1 * ((price - 1000) / 1000) + 0.1
  return 1.0
}

const currentPrice = computed(() => {
  if (currentBillingCycle.value === 'yearly') {
    return Math.round(sliderValue.value * 0.8)
  }
  return sliderValue.value
})

const currentCredits = computed(() => {
  const baseCredits = sliderValue.value * BASE_CREDITS_PER_DOLLAR
  const multiplier = getDiscountMultiplier(sliderValue.value)
  return Math.round(baseCredits * multiplier)
})

const videoEstimate = computed(() =>
  Math.round(currentCredits.value / CREDITS_PER_VIDEO)
)

const currentTierKey = computed<TierKey | null>(() =>
  subscription.value?.tier ? TIER_TO_KEY[subscription.value.tier] : null
)

const isCurrentPlanSelected = computed(() => {
  return currentTierKey.value === 'pro' && !subscription.value?.isCancelled
})

const features = computed(() => [
  t('subscription.teamPlan.maxRuntime'),
  t('subscription.teamPlan.addCredits'),
  t('subscription.teamPlan.importLoRAs'),
  t('subscription.teamPlan.centralizedBilling'),
  t('subscription.teamPlan.roleBasedPermissions')
])

const resolvedButtonLabel = computed(() => {
  if (subscribeButtonLabel) return subscribeButtonLabel
  return currentBillingCycle.value === 'yearly'
    ? t('subscription.teamPlan.subscribeToYearly')
    : t('subscription.teamPlan.subscribeToMonthly')
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

function handleContactUs() {
  emit('contactUs')
}
</script>
