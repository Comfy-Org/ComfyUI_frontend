<template>
  <div class="flex flex-col xl:h-full">
    <!-- Plan-scope toggle (personal vs team PLAN on one workspace): sits directly
         on top of the content area — outside it, attached with no gap (DES QA).
         Only shown when team plans are available (teamWorkspacesEnabled). -->
    <div v-if="showTeam" class="flex justify-center">
      <SelectButton
        v-model="planMode"
        :options="planScopeOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        unstyled
        :pt="planScopeButtonPt"
      />
    </div>

    <!-- Content well: a borderless base-background area (DES-197 "Personal Plan,
         Yearly" 2951:584251 — bg base-background, rounded-2xl, NO border, 32px
         padding) holding the description, billing toggle and plan cards on one
         uniform surface. "Remove the outline" = drop the border, not the area.
         Grows to fill the dialog so its height stays constant across the
         personal/team toggle. -->
    <div
      class="flex min-h-0 flex-col gap-6 rounded-2xl bg-base-background p-8 xl:flex-1"
    >
      <!-- Plan-scope description, above the billing toggle (DES-197). -->
      <I18nT
        v-if="planMode === 'personal'"
        keypath="subscription.personalHeader"
        tag="p"
        class="m-0 text-center text-sm text-muted-foreground"
      >
        <template #action>
          <button
            type="button"
            class="cursor-pointer border-none bg-transparent p-0 text-sm text-base-foreground hover:text-muted-foreground"
            @click="planMode = 'team'"
          >
            {{ t('subscription.personalHeaderAction') }}
          </button>
        </template>
      </I18nT>
      <I18nT
        v-else
        keypath="subscription.teamHeader"
        tag="p"
        class="m-0 text-center text-sm text-muted-foreground"
      >
        <template #learnMore>
          <button
            type="button"
            class="cursor-pointer border-none bg-transparent p-0 text-sm text-base-foreground hover:text-muted-foreground"
            @click="handleViewEnterprise"
          >
            {{ t('subscription.teamHeaderLearnMore') }}
          </button>
        </template>
      </I18nT>

      <!-- Billing-cycle toggle: drives both the personal tier cards and the
           team credit slider (team monthly halves the yearly discount). -->
      <div class="flex justify-center">
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
                class="flex items-center rounded-full bg-primary-background px-2 py-0.5 text-2xs font-bold whitespace-nowrap text-white"
              >
                {{
                  planMode === 'team'
                    ? t('subscription.saveYearlyUpTo')
                    : t('subscription.saveYearly')
                }}
              </div>
            </div>
          </template>
        </SelectButton>
      </div>

      <EduVerifyCallout />

      <!-- PERSONAL PLANS: tier cards (data-driven via the billing facade,
         falling back to TIER_PRICING). -->
      <div
        v-if="planMode === 'personal'"
        class="flex flex-col items-stretch gap-6 xl:flex-1 xl:flex-row xl:justify-center"
      >
        <div
          v-for="tier in tiers"
          :key="tier.id"
          class="flex flex-col rounded-2xl border border-border-default bg-base-background shadow-[0_0_12px_rgba(0,0,0,0.1)] xl:w-80"
          :data-testid="`pricing-tier-${tier.key}`"
        >
          <div class="flex flex-1 flex-col gap-4 p-6 pb-0">
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
                  class="font-inter text-[28px] leading-normal font-semibold text-base-foreground tabular-nums"
                >
                  ${{ getPrice(tier) }}
                  <span
                    v-if="getStruckPrice(tier) !== null"
                    class="text-2xl text-muted-foreground line-through"
                  >
                    ${{ getStruckPrice(tier) }}
                  </span>
                </span>
                <span class="font-inter text-sm/normal text-base-foreground">
                  {{ t('subscription.usdPerMonth') }}
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

            <div class="h-px w-full bg-border-default" />

            <!-- Progressive feature list: "What's included" then
                 "Everything in {prev tier}, plus:" (DES-197). -->
            <div class="flex flex-col gap-3">
              <span class="text-sm text-muted-foreground">
                {{ tier.featuresHeader }}
              </span>
              <div
                v-for="feature in tier.features"
                :key="feature"
                class="flex flex-row items-start gap-2"
              >
                <i class="pi pi-check mt-0.5 text-xs text-base-foreground" />
                <span class="text-sm font-normal text-muted-foreground">
                  {{ feature }}
                </span>
              </div>
            </div>

            <!-- Credit grant + template-based video estimate, pinned to the
                 card bottom so the figures align across tiers. -->
            <div class="mt-auto flex flex-col gap-1">
              <div class="flex flex-row items-center gap-2">
                <i
                  class="icon-[comfy--credits] size-4 shrink-0 bg-credit"
                  aria-hidden="true"
                />
                <span
                  class="font-inter text-sm/normal font-bold text-base-foreground tabular-nums"
                >
                  {{ n(tier.pricing.credits) }}
                </span>
                <span class="text-sm text-muted-foreground">
                  {{ t('subscription.monthlyCredits') }}
                </span>
              </div>
              <span class="text-sm text-muted-foreground">
                {{
                  t('subscription.videoEstimate', {
                    count: n(tier.pricing.videoEstimate)
                  })
                }}
              </span>
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

      <!-- TEAM PLAN: [Team Plan | Details] card + Enterprise card -->
      <div v-else class="flex min-h-0 flex-col gap-6 xl:flex-1">
        <div
          class="flex flex-col items-stretch gap-6 xl:flex-1 xl:flex-row xl:justify-center"
        >
          <!-- Team Plan + Details share one card, split by a divider. -->
          <div
            class="flex flex-[2.6] flex-col rounded-2xl border border-border-default bg-base-background shadow-[0_0_12px_rgba(0,0,0,0.1)] xl:flex-row xl:overflow-hidden"
          >
            <!-- Team Plan column -->
            <div class="flex flex-[1.6] flex-col gap-6 p-6">
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

              <!-- Credit slider owns its price/discount/billed display; the
                   cycle halves the yearly discount when monthly. -->
              <CreditSlider
                v-model="teamUsd"
                :stops="teamStops"
                :default-stop-index="teamDefaultStopIndex"
                :cycle="currentBillingCycle"
                :extra-discount-percent="teamEduExtraPercent"
              />

              <!-- Selected credit grant + template-based video estimate -->
              <div class="flex flex-col gap-1">
                <div class="flex flex-row items-center gap-2">
                  <i
                    class="icon-[comfy--credits] size-4 shrink-0 bg-credit"
                    aria-hidden="true"
                  />
                  <span
                    class="font-inter text-sm/normal font-bold text-base-foreground tabular-nums"
                  >
                    {{ n(teamCredits) }}
                  </span>
                  <span class="text-sm text-muted-foreground">
                    {{ t('subscription.monthlyCredits') }}
                  </span>
                </div>
                <span class="text-sm text-muted-foreground">
                  {{
                    t('subscription.videoEstimate', {
                      count: n(teamVideoEstimate)
                    })
                  }}
                </span>
              </div>

              <!-- CTA pinned to the card bottom (aligns with Enterprise CTA) -->
              <Button
                variant="inverted"
                :disabled="isTeamButtonDisabled"
                class="mt-auto h-10 w-full font-inter text-sm/normal font-bold"
                @click="handleSubscribeTeam"
              >
                {{ teamButtonLabel }}
              </Button>
            </div>

            <!-- Divider: horizontal when stacked, vertical at xl -->
            <div
              class="h-px w-full shrink-0 self-stretch bg-border-default xl:h-auto xl:w-px"
            />

            <!-- Details column -->
            <div class="flex flex-1 flex-col gap-4 p-6">
              <span
                class="font-inter text-base/normal font-bold text-base-foreground"
              >
                {{ t('subscription.teamPlan.detailsTitle') }}
              </span>

              <div class="flex flex-col gap-3">
                <span class="text-sm text-muted-foreground">
                  {{
                    t('subscription.everythingInPlus', {
                      plan: t('subscription.tiers.pro.name')
                    })
                  }}
                </span>
                <div
                  v-for="perk in teamDetailPerks"
                  :key="perk"
                  class="flex flex-row items-start gap-2"
                >
                  <i class="pi pi-check mt-0.5 text-xs text-base-foreground" />
                  <span class="text-sm font-normal text-muted-foreground">
                    {{ perk }}
                  </span>
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <span class="text-sm text-muted-foreground">
                  {{ t('subscription.teamPlan.comingSoonLabel') }}
                </span>
                <div class="flex flex-row items-start gap-2">
                  <i class="pi pi-clock mt-0.5 text-xs text-muted-foreground" />
                  <span class="text-sm font-normal text-muted-foreground">
                    {{ t('subscription.teamPlan.perkProjectAssets') }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Enterprise card -->
          <div
            class="flex flex-1 flex-col gap-4 rounded-2xl border border-border-default bg-base-background p-6 shadow-[0_0_12px_rgba(0,0,0,0.1)]"
          >
            <span
              class="font-inter text-base/normal font-bold text-base-foreground"
            >
              {{ t('subscription.enterprise.name') }}
            </span>
            <div class="flex flex-col gap-3">
              <span class="text-sm/relaxed font-normal text-muted-foreground">
                {{ t('subscription.enterprise.needMoreMembers') }}
              </span>
              <span class="text-sm/relaxed font-normal text-muted-foreground">
                {{ t('subscription.enterprise.flexibility') }}
              </span>
            </div>
            <div class="h-px w-full bg-border-default" />
            <span class="text-sm/relaxed font-normal text-muted-foreground">
              {{ t('subscription.enterprise.reachOut') }}
            </span>
            <Button
              variant="secondary"
              class="mt-auto h-10 w-full border-transparent bg-secondary-background font-bold hover:bg-secondary-background-hover"
              @click="handleViewEnterprise"
            >
              {{ t('subscription.enterprise.cta') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footnote: template caveat + contact / pricing links -->
    <I18nT
      keypath="subscription.pricingBlurb"
      tag="p"
      class="m-0 mt-auto pt-4 text-center text-sm text-text-secondary"
    >
      <template #seeDetails>
        <a
          :href="VIDEO_TEMPLATE_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="cursor-pointer text-sm text-base-foreground no-underline hover:text-muted-foreground"
        >
          {{ t('subscription.pricingBlurbSeeDetails') }}
        </a>
      </template>
      <template #questions>
        <a
          :href="QUESTIONS_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="cursor-pointer text-sm text-base-foreground no-underline hover:text-muted-foreground"
        >
          {{ t('subscription.pricingBlurbQuestions') }}
        </a>
      </template>
      <template #enterpriseDiscussions>
        <a
          :href="ENTERPRISE_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="cursor-pointer text-sm text-base-foreground no-underline hover:text-muted-foreground"
        >
          {{ t('subscription.pricingBlurbEnterprise') }}
        </a>
      </template>
      <template #clickHere>
        <a
          :href="PRICING_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="cursor-pointer text-sm text-base-foreground no-underline hover:text-muted-foreground"
        >
          {{ t('subscription.pricingBlurbClickHere') }}
        </a>
      </template>
    </I18nT>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import SelectButton from 'primevue/selectbutton'
import type { ToggleButtonPassThroughMethodOptions } from 'primevue/togglebutton'
import { computed, onMounted, ref, watch } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import EduVerifyCallout from '@/platform/cloud/subscription/components/EduVerifyCallout.vue'

import Button from '@/components/ui/button/Button.vue'
import CreditSlider from '@/components/ui/credit-slider/CreditSlider.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  TIER_PRICING,
  TIER_TO_KEY,
  applyEduDiscount,
  TEAM_EDU_EXTRA_PERCENT
} from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  SubscriptionTier,
  TierKey,
  TierPricing
} from '@/platform/cloud/subscription/constants/tierPricing'
import { useBillingPlans } from '@/platform/cloud/subscription/composables/useBillingPlans'
import { useEduPricing } from '@/platform/cloud/subscription/composables/useEduPricing'
import {
  DEFAULT_TEAM_PLAN_STOP_INDEX,
  TEAM_PLAN_CREDIT_STOPS,
  getStopDiscountedMonthlyUsd,
  mapApiTeamCreditStops
} from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { Plan } from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

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
  subscribeTeam: [
    payload: {
      stop: TeamPlanSelection
      billingCycle: BillingCycle
      /** See `isTeamPlanChange`. */
      isChange: boolean
    }
  ]
}>()

const { t, n } = useI18n()
const { flags } = useFeatureFlags()
const { permissions } = useWorkspaceUI()

/** Team plans only exist behind the flag (mirrors useBillingContext type). */
const showTeam = computed(() => flags.teamWorkspacesEnabled)

const planMode = ref<'personal' | 'team'>(initialPlanMode)

/** The Wan 2.2 i2v template the video estimates are based on. */
const VIDEO_TEMPLATE_URL =
  'https://cloud.comfy.org/?template=video_wan2_2_14B_i2v'

/** External footnote destinations — rendered as real links (open in a new tab). */
const QUESTIONS_URL = 'https://portal.usepylon.com/comfy-org/forms/question'
const ENTERPRISE_URL = 'https://www.comfy.org/enterprise'
const PRICING_URL = 'https://www.comfy.org/pricing'

/** Videos-per-credit ratio is constant across tiers; reuse it for the team
 *  plan's template-based estimate until the BE carries a team figure. */
const VIDEO_PER_CREDIT =
  TIER_PRICING.pro.videoEstimate / TIER_PRICING.pro.credits

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
  /** "What's included:" (Standard) or "Everything in {prev}, plus:". */
  featuresHeader: string
  features: string[]
  isPopular?: boolean
}

// Billing-cycle toggle: the active option is a solid white pill (DES-197).
const toggleButtonPt = {
  root: {
    class: 'flex gap-1 bg-secondary-background rounded-lg p-1.5'
  },
  pcToggleButton: {
    root: ({ context }: ToggleButtonPassThroughMethodOptions) => ({
      class: [
        // min-w keeps Yearly (with its discount badge) and Monthly the same
        // width so the active pill doesn't resize when toggling (DES QA).
        'h-8 min-w-44 px-5 rounded-md transition-colors cursor-pointer border-none outline-none ring-0 text-sm font-medium flex items-center justify-center',
        context.active
          ? 'bg-base-foreground text-base-background'
          : 'bg-transparent text-muted-foreground hover:bg-secondary-background-hover'
      ]
    }),
    label: { class: 'flex items-center gap-2 ' }
  }
}

// Plan-scope toggle (For Personal / For Teams): active is a subtle raised pill,
// not the solid white of the billing toggle (DES-197 2951:592113).
const planScopeButtonPt = {
  // No pill container (DES "Plan Type Tabs" 2812:818371 has no bg) — just the
  // tabs, so the active base-background tab sits flush on top of the content area.
  root: {
    class: 'flex gap-1'
  },
  pcToggleButton: {
    root: ({ context }: ToggleButtonPassThroughMethodOptions) => ({
      class: [
        'h-8 px-4 rounded-t-md transition cursor-pointer border-none outline-none ring-0 text-sm font-medium flex items-center justify-center',
        // Inactive tab is the active tab at half opacity (DES QA) — same fill
        // and text, faded as one, not a separate muted colour.
        context.active
          ? 'bg-base-background text-base-foreground'
          : 'bg-base-background text-base-foreground opacity-50 hover:opacity-100'
      ]
    }),
    label: { class: 'flex items-center gap-2' }
  }
}

const allPlanScopeOptions: PlanScopeOption[] = [
  { label: t('subscription.planScope.personal'), value: 'personal' },
  { label: t('subscription.planScope.team'), value: 'team' }
]

const billingCycleOptions: BillingCycleOption[] = [
  { label: t('subscription.yearly'), value: 'yearly' },
  { label: t('subscription.monthly'), value: 'monthly' }
]

/** Team-plan "Details" column perks (DES-197), shown under "Everything in Pro". */
const teamDetailPerks: string[] = [
  t('subscription.teamPlan.perkInviteMembers'),
  t('subscription.teamPlan.perkConcurrentRuns'),
  t('subscription.teamPlan.perkSharedPool'),
  t('subscription.teamPlan.perkRolePermissions')
]

const tiers: PricingTierConfig[] = [
  {
    id: 'STANDARD',
    key: 'standard',
    name: t('subscription.tiers.standard.name'),
    pricing: TIER_PRICING.standard,
    featuresHeader: t('subscription.whatsIncluded'),
    features: [
      t('subscription.tiers.standard.feature1'),
      t('subscription.tiers.standard.feature2')
    ],
    isPopular: false
  },
  {
    id: 'CREATOR',
    key: 'creator',
    name: t('subscription.tiers.creator.name'),
    pricing: TIER_PRICING.creator,
    featuresHeader: t('subscription.everythingInPlus', {
      plan: t('subscription.tiers.standard.name')
    }),
    features: [t('subscription.tiers.creator.feature1')],
    isPopular: true
  },
  {
    id: 'PRO',
    key: 'pro',
    name: t('subscription.tiers.pro.name'),
    pricing: TIER_PRICING.pro,
    featuresHeader: t('subscription.everythingInPlus', {
      plan: t('subscription.tiers.creator.name')
    }),
    features: [t('subscription.tiers.pro.feature1')],
    isPopular: false
  }
]

const {
  plans: apiPlans,
  currentPlanSlug,
  fetchPlans,
  isTeamPlan,
  subscription,
  currentTeamCreditStop
} = useBillingContext()

const canSelectPersonalPlan = computed(
  () => !isTeamPlan.value || permissions.value.canDowngradeToPersonal
)

const planScopeOptions = computed(() =>
  canSelectPersonalPlan.value
    ? allPlanScopeOptions
    : allPlanScopeOptions.filter((option) => option.value === 'team')
)

watch(
  canSelectPersonalPlan,
  (canSelect) => {
    if (!canSelect) planMode.value = 'team'
  },
  { immediate: true }
)

const { teamCreditStops } = useBillingPlans()

const isCancelled = computed(() => subscription.value?.isCancelled ?? false)

const currentBillingCycle = ref<BillingCycle>('yearly')

// Team credit stops: backend-sourced when the API supplies them, otherwise the
// hardcoded DES-197 fallback so OSS / pre-deploy still renders. Always non-empty
// so the default/selected stops below are guaranteed defined.
const teamStops = computed(() => {
  const apiStops = teamCreditStops.value?.stops
  return apiStops?.length
    ? mapApiTeamCreditStops(apiStops)
    : TEAM_PLAN_CREDIT_STOPS
})
const teamDefaultStopIndex = computed(
  () =>
    teamCreditStops.value?.default_stop_index ?? DEFAULT_TEAM_PLAN_STOP_INDEX
)
const defaultTeamStop = computed(
  () => teamStops.value[teamDefaultStopIndex.value] ?? teamStops.value[0]
)

const teamUsd = ref<number>(defaultTeamStop.value.usd)

// The selected stop follows the slider's USD value; when it matches none (e.g.
// the API stops loaded after mount with different breakpoints) it falls back to
// the default stop so the id/credits stay consistent with what's displayed.
const selectedTeamStop = computed(
  () =>
    teamStops.value.find((stop) => stop.usd === teamUsd.value) ??
    defaultTeamStop.value
)
const teamCredits = computed(() => selectedTeamStop.value.credits)
const teamVideoEstimate = computed(() =>
  Math.round(teamCredits.value * VIDEO_PER_CREDIT)
)

// The team's currently-subscribed stop (null when on no team plan). Matched to
// the slider stops by list price so the current stop can be disabled.
const isTeamSubscribed = computed(() => currentTeamCreditStop.value !== null)

// `teamUsd` is seeded at mount from the fallback default; when the API stops
// resolve afterwards with different breakpoints that seed can match no stop,
// leaving the slider position and the subscribe payload out of sync. Snap to the
// resolved default — but only while no real stop is pinned (a subscriber's stop
// is set below; a user's own selection already matches a stop).
watch(defaultTeamStop, (stop) => {
  if (currentTeamCreditStop.value) return
  if (teamStops.value.some((s) => s.usd === teamUsd.value)) return
  teamUsd.value = stop.usd
})

// Start the slider on the current stop so an active subscriber sees their plan
// (disabled) and must move off it to change.
watch(
  currentTeamCreditStop,
  (stop) => {
    if (!stop) return
    teamUsd.value = stop.stop_usd
  },
  { immediate: true }
)

// The CTA — not the slider stop — reflects the current plan: on the active stop
// it reads "Current plan" (disabled); a cancelled plan re-subscribes on its
// stop. Any other stop is locked because the credit stop can't be changed. The
// subscribed stop must be one of the available stops for the slider to land on
// it, so match against `teamStops` rather than the hardcoded fallback.
const isTeamCurrentStopSelected = computed(() => {
  const usd = currentTeamCreditStop.value?.stop_usd
  return (
    usd != null &&
    usd === teamUsd.value &&
    teamStops.value.some((stop) => stop.usd === usd)
  )
})

// Yearly and monthly at the same credit stop are distinct plans, so toggling
// the cycle is a change, not the current plan.
const subscribedCycle = computed<BillingCycle>(() =>
  subscription.value?.duration === 'MONTHLY' ? 'monthly' : 'yearly'
)
const isTeamCurrentPlanSelected = computed(
  () =>
    isTeamCurrentStopSelected.value &&
    currentBillingCycle.value === subscribedCycle.value
)

const teamButtonLabel = computed(() => {
  if (!isTeamSubscribed.value) {
    return currentBillingCycle.value === 'yearly'
      ? t('subscription.teamPlan.cta')
      : t('subscription.teamPlan.ctaMonthly')
  }
  // The exact current plan re-subscribes (cancelled) or reads "Current plan"
  // (active); any other stop or cycle is a change.
  if (isTeamCurrentPlanSelected.value) {
    return isCancelled.value
      ? t('subscription.resubscribe')
      : t('subscription.teamPlan.currentPlan')
  }
  return t('subscription.teamPlan.changePlan')
})

const isTeamButtonDisabled = computed(
  () =>
    !permissions.value.canManageSubscription ||
    isLoading ||
    (isTeamSubscribed.value &&
      isTeamCurrentPlanSelected.value &&
      !isCancelled.value)
)

// A subscriber moving off their current plan is a prorated change rather than a
// fresh subscribe; re-subscribe and the locked current plan exit before the
// change emit, so this drives the prorated transition preview.
const isTeamPlanChange = computed(
  () => isTeamSubscribed.value && !isTeamCurrentPlanSelected.value
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

  // Free tier is not a paid plan to "change" from — those users subscribe.
  const hasActivePaidPlan =
    currentTierKey.value !== null && currentTierKey.value !== 'free'

  return hasActivePaidPlan
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
  if (
    isLoading ||
    !permissions.value.canManageSubscription ||
    !canSelectPersonalPlan.value
  )
    return true
  if (isCurrentPlan(tier.key)) {
    return !isCancelled.value
  }
  return false
}

const getButtonTextClass = (tier: PricingTierConfig): string =>
  tier.key === 'creator'
    ? 'font-inter text-sm font-bold leading-normal text-base-background'
    : 'font-inter text-sm font-bold leading-normal text-primary-foreground'

const { isEduPricingActive } = useEduPricing()
const teamEduExtraPercent = computed(() =>
  isEduPricingActive.value ? TEAM_EDU_EXTRA_PERCENT : 0
)

// Personal tiers only: the coupon cut applies to the API-derived price (or the
// static fallback); team pricing is out of scope for the EDU promo.
const getPrice = (tier: PricingTierConfig): number => {
  const base = getPriceFromApi(tier) ?? tier.pricing[currentBillingCycle.value]
  return isEduPricingActive.value
    ? applyEduDiscount(base, tier.key, currentBillingCycle.value)
    : base
}

const getMonthlyPrice = (tier: PricingTierConfig): number => {
  const plan = getApiPlanForTier(tier.key, 'monthly')
  return plan ? plan.price_cents / 100 : tier.pricing.monthly
}

// Struck monthly list price: shown on yearly (the bundle saving) and whenever
// EDU is active, so the EDU yearly card reads 25% off the monthly list.
const getStruckPrice = (tier: PricingTierConfig): number | null => {
  if (isEduPricingActive.value || currentBillingCycle.value === 'yearly')
    return getMonthlyPrice(tier)
  return null
}

const getAnnualTotal = (tier: PricingTierConfig): number => {
  const plan = getApiPlanForTier(tier.key, 'yearly')
  const total = plan ? plan.price_cents / 100 : tier.pricing.yearly * 12
  return isEduPricingActive.value
    ? applyEduDiscount(total, tier.key, 'yearly')
    : total
}

function handleSubscribe(tierKey: CheckoutTierKey) {
  if (
    isLoading ||
    !permissions.value.canManageSubscription ||
    !canSelectPersonalPlan.value
  )
    return
  if (isCurrentPlan(tierKey)) {
    if (isCancelled.value) {
      emit('resubscribe')
    }
    return
  }
  emit('subscribe', { tierKey, billingCycle: currentBillingCycle.value })
}

function handleSubscribeTeam() {
  if (isTeamButtonDisabled.value) return
  // Re-subscribe only when keeping the exact current plan; any other stop or
  // cycle is a change.
  if (isCancelled.value && isTeamCurrentPlanSelected.value) {
    emit('resubscribe')
    return
  }
  const stop = selectedTeamStop.value
  emit('subscribeTeam', {
    stop: {
      id: stop.id,
      usd: stop.usd,
      credits: stop.credits,
      discountedUsd: getStopDiscountedMonthlyUsd(
        stop,
        currentBillingCycle.value,
        teamEduExtraPercent.value
      )
    },
    billingCycle: currentBillingCycle.value,
    isChange: isTeamPlanChange.value
  })
}

function handleViewEnterprise() {
  window.open(ENTERPRISE_URL, '_blank')
}
</script>
