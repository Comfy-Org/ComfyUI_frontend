<template>
  <div class="flex flex-col gap-6">
    <!-- Plan-scope toggle (Gamma-style): personal vs team PLAN on one workspace.
         Only shown when team plans are available (teamWorkspacesEnabled). -->
    <div v-if="showTeam" class="flex justify-center">
      <SelectButton
        v-model="planMode"
        :options="planScopeOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        unstyled
        :pt="toggleButtonPt"
      />
    </div>

    <!-- Billing-cycle toggle (personal tiers only; the team plan is a yearly
         commitment expressed through the slider). -->
    <div v-if="planMode === 'personal'" class="flex justify-center">
      <SelectButton
        v-model="currentBillingCycle"
        :options="billingCycleOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        unstyled
        :pt="toggleButtonPt"
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <span>{{ option.label }}</span>
            <div
              v-if="option.value === 'yearly'"
              class="flex items-center rounded-full bg-primary-background px-1 py-0.5 text-2xs font-bold text-white"
            >
              -20%
            </div>
          </div>
        </template>
      </SelectButton>
    </div>

    <!-- PERSONAL PLANS: tier cards (data-driven via the billing facade,
         falling back to TIER_PRICING). -->
    <div
      v-if="planMode === 'personal'"
      class="flex flex-col items-stretch gap-4 xl:flex-row"
    >
      <div
        v-for="tier in tiers"
        :key="tier.id"
        :class="
          cn(
            'flex flex-1 flex-col rounded-2xl border border-border-default bg-base-background shadow-[0_0_12px_rgba(0,0,0,0.1)]',
            tier.isPopular ? 'border-emerald-500' : ''
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
          <div class="flex flex-col gap-2">
            <div class="flex flex-row items-baseline gap-2">
              <span
                class="font-inter text-[28px] leading-normal font-semibold text-base-foreground"
              >
                <span
                  v-show="currentBillingCycle === 'yearly'"
                  class="text-2xl text-muted-foreground line-through"
                >
                  ${{ getMonthlyPrice(tier) }}
                </span>
                ${{ getPrice(tier) }}
              </span>
              <span class="font-inter text-sm/normal text-base-foreground">
                {{ t('subscription.usdPerMonthPerMember') }}
              </span>
            </div>
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

          <div class="flex flex-1 flex-col gap-3 pb-0">
            <div class="flex flex-row items-center justify-between">
              <span class="text-foreground text-sm font-normal">
                {{ t('subscription.monthlyCreditsPerMemberLabel') }}
              </span>
              <div class="flex flex-row items-center gap-1">
                <i class="icon-[lucide--component] text-sm text-amber-400" />
                <span
                  class="font-inter text-sm/normal font-bold text-base-foreground"
                >
                  {{ n(tier.pricing.credits) }}
                </span>
              </div>
            </div>

            <div class="flex flex-row items-center justify-between">
              <span class="text-foreground text-sm font-normal">
                {{ t('subscription.maxDurationLabel') }}
              </span>
              <span
                class="font-inter text-sm/normal font-bold text-base-foreground"
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
                {{ t('subscription.customLoRAsLabel') }}
              </span>
              <i
                v-if="tier.customLoRAs"
                class="pi pi-check text-success-foreground text-xs"
              />
              <i v-else class="pi pi-times text-foreground text-xs" />
            </div>

            <div class="flex flex-row items-start justify-between">
              <div class="flex flex-col gap-2">
                <span class="text-foreground text-sm/relaxed font-normal">
                  {{ t('subscription.videoEstimateLabel') }}
                </span>
                <div class="group flex flex-row items-center gap-2 pt-2">
                  <i
                    class="pi pi-question-circle text-xs text-muted-foreground group-hover:text-base-foreground"
                  />
                  <span
                    class="cursor-pointer text-sm font-normal text-muted-foreground group-hover:text-base-foreground"
                    @click="togglePopover"
                  >
                    {{ t('subscription.videoEstimateHelp') }}
                  </span>
                </div>
              </div>
              <span
                class="font-inter text-sm/normal font-bold text-base-foreground"
              >
                ~{{ n(tier.pricing.videoEstimate) }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex flex-col p-6">
          <Button
            :variant="getButtonSeverity(tier)"
            :disabled="isButtonDisabled(tier)"
            :loading="loadingTier === tier.key"
            :class="
              cn(
                'h-10 w-full',
                getButtonTextClass(tier),
                tier.key === 'creator'
                  ? 'border-transparent bg-success-background hover:bg-success-background/80'
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

    <!-- TEAM PLAN: credit slider + Enterprise card -->
    <div v-else class="flex flex-col items-stretch gap-4 xl:flex-row">
      <!-- Team plan card -->
      <div
        class="flex flex-2 flex-col gap-4 rounded-2xl border border-border-default bg-base-background p-6 shadow-[0_0_12px_rgba(0,0,0,0.1)]"
      >
        <div class="flex flex-col gap-1">
          <span
            class="font-inter text-base/normal font-bold text-base-foreground"
          >
            {{ t('subscription.teamPlan.name') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ t('subscription.teamPlan.tagline') }}
          </span>
        </div>

        <!-- Credit slider owns its price/discount/billed-yearly display -->
        <CreditSlider v-model="teamUsd" @change="onTeamChange" />

        <div class="flex flex-1 flex-col gap-3">
          <div class="flex flex-row items-center gap-2">
            <i class="pi pi-check text-success-foreground text-xs" />
            <span class="text-foreground text-sm font-normal">
              {{
                t('subscription.teamPlan.invite', { count: TEAM_MAX_MEMBERS })
              }}
            </span>
          </div>
          <div class="flex flex-row items-center gap-2">
            <i class="pi pi-check text-success-foreground text-xs" />
            <span class="text-foreground text-sm font-normal">
              {{ t('subscription.teamPlan.sharedCredits') }}
            </span>
          </div>
          <div class="flex flex-row items-center gap-2">
            <i class="pi pi-check text-success-foreground text-xs" />
            <span class="text-foreground text-sm font-normal">
              {{ t('subscription.teamPlan.allProFeatures') }}
            </span>
          </div>
        </div>

        <Button
          variant="primary"
          :disabled="isLoading"
          class="h-10 w-full border-transparent bg-success-background font-bold text-base-background hover:bg-success-background/80"
          @click="handleSubscribeTeam"
        >
          {{ t('subscription.teamPlan.cta') }}
        </Button>
      </div>

      <!-- Enterprise card -->
      <div
        class="flex flex-1 flex-col gap-4 rounded-2xl border border-border-default bg-base-background p-6 shadow-[0_0_12px_rgba(0,0,0,0.1)]"
      >
        <div class="flex flex-col gap-1">
          <span
            class="font-inter text-base/normal font-bold text-base-foreground"
          >
            {{ t('subscription.enterprise.name') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ t('subscription.enterprise.tagline') }}
          </span>
        </div>
        <p class="text-foreground m-0 flex-1 text-sm/relaxed">
          {{ t('subscription.enterprise.description') }}
        </p>
        <Button
          variant="secondary"
          class="h-10 w-full border-transparent bg-secondary-background font-bold hover:bg-secondary-background-hover"
          @click="handleViewEnterprise"
        >
          {{ t('subscription.enterprise.cta') }}
          <i class="pi pi-external-link" />
        </Button>
      </div>
    </div>

    <!-- Video Estimate Help Popover (shared) -->
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
            'rounded-lg border border-interface-stroke bg-interface-panel-surface shadow-lg p-4 max-w-xs'
        }
      }"
    >
      <div class="flex flex-col gap-2">
        <p class="text-sm/normal text-base-foreground">
          {{ t('subscription.videoEstimateExplanation') }}
        </p>
        <a
          href="https://cloud.comfy.org/?template=video_wan2_2_14B_i2v"
          target="_blank"
          rel="noopener noreferrer"
          class="flex gap-1 text-sm text-azure-600 no-underline hover:text-azure-400"
        >
          <span class="underline">
            {{ t('subscription.videoEstimateTryTemplate') }}
          </span>
          <span class="no-underline" v-html="'&rarr;'"></span>
        </a>
      </div>
    </Popover>

    <!-- Contact / Enterprise links -->
    <div class="flex flex-col items-center gap-2">
      <p class="m-0 text-sm text-text-secondary">
        {{ t('subscription.haveQuestions') }}
      </p>
      <div class="flex items-center gap-1.5">
        <Button
          variant="muted-textonly"
          class="h-6 p-1 text-sm text-text-secondary hover:text-base-foreground"
          @click="handleContactUs"
        >
          {{ t('subscription.contactUs') }}
          <i class="pi pi-comments" />
        </Button>
        <span class="text-sm text-text-secondary">{{ t('g.or') }}</span>
        <Button
          variant="muted-textonly"
          class="h-6 p-1 text-sm text-text-secondary hover:text-base-foreground"
          @click="handleViewEnterprise"
        >
          {{ t('subscription.viewEnterprise') }}
          <i class="pi pi-external-link" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import type { ToggleButtonPassThroughMethodOptions } from 'primevue/togglebutton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import CreditSlider from '@/components/ui/credit-slider/CreditSlider.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
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
  DEFAULT_TEAM_PLAN_STOP_INDEX,
  TEAM_PLAN_CREDIT_STOPS
} from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { Plan } from '@/platform/workspace/api/workspaceApi'

type CheckoutTierKey = Exclude<TierKey, 'free' | 'founder'>

interface Props {
  isLoading?: boolean
  loadingTier?: CheckoutTierKey | null
  /** Initial plan scope. The toggle to switch is only shown when team plans
   *  are available (`teamWorkspacesEnabled`). */
  initialPlanMode?: 'personal' | 'team'
}

const {
  isLoading,
  loadingTier = null,
  initialPlanMode = 'personal'
} = defineProps<Props>()

const emit = defineEmits<{
  subscribe: [payload: { tierKey: CheckoutTierKey; billingCycle: BillingCycle }]
  resubscribe: []
  // Team-plan checkout. NOTE: the slider stop -> plan-slug mapping is blocked on
  // the BE discount-breakpoint contract (FE-934 / doc Open Q#2); the host stubs
  // this until the contract lands.
  subscribeTeam: [payload: { usd: number; credits: number }]
}>()

const { t, n } = useI18n()
const { flags } = useFeatureFlags()

/** Team plans only exist behind the flag (mirrors useBillingContext type). */
const showTeam = computed(() => flags.teamWorkspacesEnabled)

const planMode = ref<'personal' | 'team'>(initialPlanMode)

const TEAM_MAX_MEMBERS = 30

interface BillingCycleOption {
  label: string
  value: BillingCycle
}

interface PlanScopeOption {
  label: string
  value: 'personal' | 'team'
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

const toggleButtonPt = {
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
    label: { class: 'flex items-center gap-2 ' }
  }
}

const planScopeOptions: PlanScopeOption[] = [
  { label: t('subscription.planScope.personal'), value: 'personal' },
  { label: t('subscription.planScope.team'), value: 'team' }
]

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
  plans: apiPlans,
  currentPlanSlug,
  fetchPlans,
  subscription
} = useBillingContext()

const isCancelled = computed(() => subscription.value?.isCancelled ?? false)

const popover = ref()
const currentBillingCycle = ref<BillingCycle>('yearly')

// Team plan selection (slider). Stop -> slug mapping is BE-blocked (see emit).
const teamUsd = ref<number>(
  TEAM_PLAN_CREDIT_STOPS[DEFAULT_TEAM_PLAN_STOP_INDEX].usd
)
const teamCredits = ref<number>(
  TEAM_PLAN_CREDIT_STOPS[DEFAULT_TEAM_PLAN_STOP_INDEX].credits
)

onMounted(() => {
  void fetchPlans()
})

function getApiPlanForTier(
  tierKey: CheckoutTierKey,
  duration: BillingCycle
): Plan | undefined {
  const apiDuration = duration === 'yearly' ? 'ANNUAL' : 'MONTHLY'
  const apiTier = tierKey.toUpperCase() as Plan['tier']
  return apiPlans.value.find(
    (p) => p.tier === apiTier && p.duration === apiDuration
  )
}

function getPriceFromApi(tier: PricingTierConfig): number | null {
  const plan = getApiPlanForTier(tier.key, currentBillingCycle.value)
  if (!plan) return null
  const price = plan.price_cents / 100
  return currentBillingCycle.value === 'yearly' ? price / 12 : price
}

const currentTierKey = computed<TierKey | null>(() =>
  subscription.value?.tier ? TIER_TO_KEY[subscription.value.tier] : null
)

const isYearlySubscription = computed(
  () => subscription.value?.duration === 'ANNUAL'
)

const isCurrentPlan = (tierKey: CheckoutTierKey): boolean => {
  if (currentPlanSlug.value) {
    const plan = getApiPlanForTier(tierKey, currentBillingCycle.value)
    return plan?.slug === currentPlanSlug.value
  }
  if (!currentTierKey.value) return false
  const selectedIsYearly = currentBillingCycle.value === 'yearly'
  return (
    currentTierKey.value === tierKey &&
    isYearlySubscription.value === selectedIsYearly
  )
}

const togglePopover = (event: Event) => {
  popover.value.toggle(event)
}

const getButtonLabel = (tier: PricingTierConfig): string => {
  const planName =
    currentBillingCycle.value === 'yearly'
      ? t('subscription.tierNameYearly', { name: tier.name })
      : tier.name

  if (isCurrentPlan(tier.key)) {
    return isCancelled.value
      ? t('subscription.resubscribeTo', { plan: planName })
      : t('subscription.currentPlan')
  }

  return currentTierKey.value
    ? t('subscription.changeTo', { plan: planName })
    : t('subscription.subscribeTo', { plan: planName })
}

const getButtonSeverity = (
  tier: PricingTierConfig
): 'primary' | 'secondary' => {
  if (isCurrentPlan(tier.key)) {
    return isCancelled.value ? 'primary' : 'secondary'
  }
  if (tier.key === 'creator') return 'primary'
  return 'secondary'
}

const isButtonDisabled = (tier: PricingTierConfig): boolean => {
  if (isLoading) return true
  if (isCurrentPlan(tier.key)) {
    return !isCancelled.value
  }
  return false
}

const getButtonTextClass = (tier: PricingTierConfig): string =>
  tier.key === 'creator'
    ? 'font-inter text-sm font-bold leading-normal text-base-background'
    : 'font-inter text-sm font-bold leading-normal text-primary-foreground'

const getPrice = (tier: PricingTierConfig): number =>
  getPriceFromApi(tier) ?? tier.pricing[currentBillingCycle.value]

const getMonthlyPrice = (tier: PricingTierConfig): number => {
  const plan = getApiPlanForTier(tier.key, 'monthly')
  return plan ? plan.price_cents / 100 : tier.pricing.monthly
}

const getAnnualTotal = (tier: PricingTierConfig): number => {
  const plan = getApiPlanForTier(tier.key, 'yearly')
  return plan ? plan.price_cents / 100 : tier.pricing.yearly * 12
}

function handleSubscribe(tierKey: CheckoutTierKey) {
  if (isLoading) return
  if (isCurrentPlan(tierKey)) {
    if (isCancelled.value) {
      emit('resubscribe')
    }
    return
  }
  emit('subscribe', { tierKey, billingCycle: currentBillingCycle.value })
}

function onTeamChange(stop: { index: number; usd: number; credits: number }) {
  teamUsd.value = stop.usd
  teamCredits.value = stop.credits
}

function handleSubscribeTeam() {
  if (isLoading) return
  emit('subscribeTeam', { usd: teamUsd.value, credits: teamCredits.value })
}

function handleContactUs() {
  window.open('https://www.comfy.org/discord', '_blank')
}

function handleViewEnterprise() {
  window.open('https://www.comfy.org/enterprise', '_blank')
}
</script>
