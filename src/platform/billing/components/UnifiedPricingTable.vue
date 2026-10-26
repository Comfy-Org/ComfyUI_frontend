<template>
  <div class="flex flex-col xl:h-full">
    <!-- Plan-scope toggle (personal vs team PLAN on one workspace): sits directly
         on top of the content area — outside it, attached with no gap (DES QA). -->
    <div class="flex justify-center">
      <ToggleGroup v-model="planMode" type="single" :allow-empty="false">
        <ToggleGroupItem
          v-for="option in planScopeOptions"
          :key="option.value"
          :value="option.value"
          class="h-8 rounded-b-none bg-background px-4 text-foreground opacity-50 hover:bg-background hover:opacity-100 data-[state=on]:bg-background data-[state=on]:opacity-100"
        >
          {{ option.label }}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <!-- Content well: a borderless base-background area (DES-197 "Personal Plan,
         Yearly" 2951:584251 — bg base-background, rounded-2xl, NO border, 32px
         padding) holding the description, billing toggle and plan cards on one
         uniform surface. "Remove the outline" = drop the border, not the area.
         Grows to fill the dialog so its height stays constant across the
         personal/team toggle. -->
    <div
      class="flex min-h-0 flex-col gap-6 rounded-2xl bg-background p-8 xl:flex-1"
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
            class="cursor-pointer border-none bg-transparent p-0 text-foreground hover:text-muted-foreground"
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
            class="cursor-pointer border-none bg-transparent p-0 text-foreground hover:text-muted-foreground"
            @click="handleViewEnterprise"
          >
            {{ t('subscription.teamHeaderLearnMore') }}
          </button>
        </template>
      </I18nT>

      <!-- Billing-cycle toggle: drives both the personal tier cards and the
           team credit slider (team monthly halves the yearly discount). -->
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
            class="h-8 min-w-44 px-5 data-[state=on]:bg-foreground data-[state=on]:text-background"
          >
            <div class="flex items-center gap-2">
              <span>{{ option.label }}</span>
              <Badge
                v-if="option.value === 'yearly'"
                variant="pill"
                severity="default"
                class="font-bold"
              >
                {{
                  planMode === 'team'
                    ? t('subscription.saveYearlyUpTo')
                    : t('subscription.saveYearly')
                }}
              </Badge>
            </div>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <!-- PERSONAL PLANS: tier cards (data-driven via the billing facade,
         falling back to TIER_PRICING). -->
      <div
        v-if="planMode === 'personal'"
        class="flex flex-col gap-6 xl:flex-1 xl:flex-row xl:justify-center"
      >
        <Card
          v-for="tier in tiers"
          :key="tier.id"
          class="flex flex-col shadow-sm xl:w-80"
        >
          <div class="flex flex-1 flex-col gap-4 p-6 pb-0">
            <PricingTierHeading
              :name="tier.name"
              :is-popular="tier.isPopular"
            />
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
                    ${{ getMonthlyPrice(tier) }}
                  </span>
                </span>
                <span class="text-sm/normal">
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

            <div class="h-px w-full bg-border" />

            <!-- Progressive feature list: "What's included" then
                 "Everything in {prev tier}, plus:" (DES-197). -->
            <div class="flex flex-col gap-3">
              <span class="text-sm text-muted-foreground">
                {{ tier.featuresHeader }}
              </span>
              <div
                v-for="feature in tier.features"
                :key="feature"
                class="flex items-start gap-2"
              >
                <i class="pi pi-check mt-0.5 text-xs" />
                <span class="text-sm font-normal text-muted-foreground">
                  {{ feature }}
                </span>
              </div>
            </div>

            <!-- Credit grant + template-based video estimate, pinned to the
                 card bottom so the figures align across tiers. -->
            <div class="mt-auto flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <i
                  class="icon-[lucide--coins] size-4 shrink-0 bg-credit"
                  aria-hidden="true"
                />
                <span class="text-sm/normal font-bold tabular-nums">
                  {{ n(creditsForTier(tier)) }}
                </span>
                <span class="text-sm text-muted-foreground">
                  {{ t(creditsLabelKey) }}
                </span>
              </div>
              <span class="text-sm text-muted-foreground">
                {{
                  t('subscription.videoEstimate', {
                    count: n(videoEstimateForTier(tier))
                  })
                }}
              </span>
            </div>
          </div>
          <div class="flex flex-col gap-2 p-6">
            <Button
              :variant="getButtonSeverity(tier)"
              :disabled="isButtonDisabled(tier)"
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
            <p
              v-if="getDeniedReasonCopy(tier.key)"
              class="m-0 text-center text-sm text-muted-foreground"
            >
              {{ getDeniedReasonCopy(tier.key) }}
            </p>
          </div>
        </Card>
      </div>

      <!-- TEAM PLAN: [Team Plan | Details] card + Enterprise card -->
      <div v-else class="flex min-h-0 flex-col gap-6 xl:flex-1">
        <div
          class="flex flex-col gap-6 xl:flex-1 xl:flex-row xl:justify-center"
        >
          <!-- Team Plan + Details share one card, split by a divider. -->
          <Card
            class="flex flex-[2.6] flex-col shadow-sm xl:flex-row xl:overflow-hidden"
          >
            <!-- Team Plan column -->
            <div class="flex flex-[1.6] flex-col gap-6 p-6">
              <div class="flex flex-col gap-1">
                <span class="text-base/normal font-bold">
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
              />

              <!-- Selected credit grant + template-based video estimate -->
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <i
                    class="icon-[lucide--coins] size-4 shrink-0 bg-credit"
                    aria-hidden="true"
                  />
                  <span class="text-sm/normal font-bold tabular-nums">
                    {{ n(teamCreditsForCurrentCycle) }}
                  </span>
                  <span class="text-sm text-muted-foreground">
                    {{ t(creditsLabelKey) }}
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
                class="mt-auto h-10 w-full text-sm/normal font-bold"
                :data-dd-action-name="BILLING_ACTION_NAME.subscribeTeamPlan"
                @click="handleSubscribeTeam"
              >
                {{ teamButtonLabel }}
              </Button>
            </div>

            <!-- Divider: horizontal when stacked, vertical at xl -->
            <div
              class="h-px w-full shrink-0 self-stretch bg-border xl:h-auto xl:w-px"
            />

            <!-- Details column -->
            <div class="flex flex-1 flex-col gap-4 p-6">
              <span class="text-base/normal font-bold">
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
                  class="flex items-start gap-2"
                >
                  <i class="pi pi-check mt-0.5 text-xs" />
                  <span class="text-sm font-normal text-muted-foreground">
                    {{ perk }}
                  </span>
                </div>
              </div>

              <div class="flex flex-col gap-3 text-muted-foreground">
                <span class="text-sm">
                  {{ t('subscription.teamPlan.comingSoonLabel') }}
                </span>
                <div class="flex items-start gap-2">
                  <i class="pi pi-clock mt-0.5 text-xs" />
                  <span class="text-sm font-normal">
                    {{ t('subscription.teamPlan.perkProjectAssets') }}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <!-- Enterprise card -->
          <Card class="flex flex-1 flex-col gap-4 p-6 shadow-sm">
            <span class="text-base/normal font-bold">
              {{ t('subscription.enterprise.name') }}
            </span>
            <div
              class="flex flex-col gap-3 text-sm/relaxed font-normal text-muted-foreground"
            >
              <span>
                {{ t('subscription.enterprise.needMoreMembers') }}
              </span>
              <span>
                {{ t('subscription.enterprise.flexibility') }}
              </span>
            </div>
            <div class="h-px w-full bg-border" />
            <span class="text-sm/relaxed font-normal text-muted-foreground">
              {{ t('subscription.enterprise.reachOut') }}
            </span>
            <Button
              variant="secondary"
              class="mt-auto h-10 w-full border-transparent font-bold"
              @click="handleViewEnterprise"
            >
              {{ t('subscription.enterprise.cta') }}
            </Button>
          </Card>
        </div>
      </div>
    </div>

    <div
      class="mt-auto flex min-h-14 flex-col items-center justify-center gap-2 pt-4 text-sm"
    >
      <div
        v-if="showPastDueNotice"
        role="status"
        data-testid="pricing-past-due-notice"
        class="flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-background"
      >
        <i
          class="icon-[lucide--info] size-4 shrink-0 bg-background"
          aria-hidden="true"
        />
        <span>
          {{
            t(
              isOwnerNotice
                ? 'subscription.pastDueNoticeOwner'
                : 'subscription.pastDueNoticeMember'
            )
          }}
        </span>
        <button
          v-if="isOwnerNotice"
          ref="updatePaymentButtonEl"
          type="button"
          class="cursor-pointer border-none bg-transparent p-0 font-inter text-sm font-bold text-background hover:opacity-80 disabled:cursor-default disabled:opacity-60"
          :disabled="isUpdatingPayment"
          @click="updatePayment"
        >
          {{ t('subscription.paymentRecovery.ownerCta') }}
        </button>
      </div>
      <div
        v-if="showScheduledPlanChange"
        role="status"
        class="flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-background"
      >
        <i
          class="icon-[lucide--info] size-4 shrink-0 bg-background"
          aria-hidden="true"
        />
        <span>
          {{
            t('subscription.scheduledChangeNotice', {
              plan: scheduledPlanChange.planName.value,
              date: scheduledPlanChange.formattedDate.value
            })
          }}
        </span>
      </div>
      <I18nT
        v-if="!showPastDueNotice && !showScheduledPlanChange"
        keypath="subscription.pricingBlurb"
        tag="p"
        class="m-0 text-center text-muted-foreground"
      >
        <template #seeDetails>
          <a
            :href="VIDEO_TEMPLATE_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="cursor-pointer text-foreground no-underline hover:text-muted-foreground"
          >
            {{ t('subscription.pricingBlurbSeeDetails') }}
          </a>
        </template>
        <template #questions>
          <a
            :href="QUESTIONS_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="cursor-pointer text-foreground no-underline hover:text-muted-foreground"
          >
            {{ t('subscription.pricingBlurbQuestions') }}
          </a>
        </template>
        <template #enterpriseDiscussions>
          <a
            :href="ENTERPRISE_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="cursor-pointer text-foreground no-underline hover:text-muted-foreground"
          >
            {{ t('subscription.pricingBlurbEnterprise') }}
          </a>
        </template>
        <template #clickHere>
          <a
            :href="PRICING_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="cursor-pointer text-foreground no-underline hover:text-muted-foreground"
          >
            {{ t('subscription.pricingBlurbClickHere') }}
          </a>
        </template>
      </I18nT>
    </div>
  </div>
</template>

<script setup lang="ts">
import Badge from '@/components/ui/badge/Badge.vue'
import PricingTierHeading from '@/platform/billing/components/PricingTierHeading.vue'
import Card from '@/components/ui/card/Card.vue'
import {
  BILLING_ACTION_NAME,
  planCtaActionName
} from '@/platform/telemetry/billingActionNames'
import type { PlanAction } from '@comfyorg/ingest-types'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import CreditSlider from '@/platform/billing/components/credit-slider/CreditSlider.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import {
  ENTERPRISE_URL,
  TIER_PRICING,
  amountForBillingCycle
} from '@/platform/billing/subscription/constants/tierPricing'
import type {
  RegistrySubscriptionTier,
  TierKey,
  TierPricing
} from '@/platform/billing/subscription/constants/tierPricing'
import {
  getStopDiscountedMonthlyUsd,
  mapApiTeamCreditStops
} from '@comfyorg/account-ui/billing/catalog'
import {
  DEFAULT_TEAM_PLAN_STOP_INDEX,
  TEAM_PLAN_CREDIT_STOPS
} from '@/platform/billing/subscription/constants/teamPlanCreditStops'
import type { TeamPlanSelection } from '@/platform/billing/subscription/constants/teamPlanCreditStops'
import type { BillingCycle } from '@/platform/billing/subscription/utils/subscriptionTierRank'
import { isCloud } from '@/platform/distribution/types'
import type { Plan } from '@/platform/workspace/api/workspaceApi'
import { formatSubscriptionDate } from '@/platform/billing/components/subscriptionPanelWorkspace.logic'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'
import { useScheduledPlanChange } from '@/platform/billing/composables/useScheduledPlanChange'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

type CheckoutTierKey = Exclude<TierKey, 'free' | 'founder'>

interface Props {
  isLoading?: boolean
  loadingTier?: CheckoutTierKey | null
  /** Initial plan scope. */
  initialPlanMode?: 'personal' | 'team'
  outstandingPaymentRefusals?: number
}

const {
  isLoading,
  loadingTier = null,
  initialPlanMode = 'personal',
  outstandingPaymentRefusals = 0
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

const { t, n, locale } = useI18n()
const capabilities = useBillingCapabilities()
const { permissions } = useWorkspaceUI()

// Every CTA here resolves to a billing write the server authorizes on its own,
// so each catalog asks whether any write that reaches it is permitted instead of
// mapping each card to one capability itself — that mapping is policy, and the
// response carries no plan dimension to derive it from. An unresolved snapshot
// is not a denial: the CTA stays live and the checkout endpoint answers, the
// same trade canOpenPricingSurface and canTopUp already make.
//
// The team catalog is not reachable by downgrading to personal, so its gate
// stops at the three writes that do reach it.
const lifecycleActionPermitted = computed(() => {
  if (!isCloud) return permissions.value.canManageSubscription
  if (!capabilities.snapshotAuthoritative.value) return true
  return (
    capabilities.canSubscribeSelfServe.value ||
    capabilities.canChangeSeats.value ||
    capabilities.canReactivate.value
  )
})

// Read on its own by the plan-scope toggle, which offers or withholds the whole
// personal catalog rather than one CTA, so it keeps its own capability.
const canDowngradeToPersonal = computed(() => {
  if (!isCloud) return permissions.value.canDowngradeToPersonal
  if (!capabilities.snapshotAuthoritative.value) return true
  return capabilities.canDowngradeToPersonal.value
})

const planMode = ref<'personal' | 'team'>(initialPlanMode)

/** The Wan 2.2 i2v template the video estimates are based on. */
const VIDEO_TEMPLATE_URL =
  'https://cloud.comfy.org/?template=video_wan2_2_14B_i2v'

/** External footnote destinations — rendered as real links (open in a new tab). */
const QUESTIONS_URL = 'https://portal.usepylon.com/comfy-org/forms/question'
const PRICING_URL = 'https://comfy.org/cloud/pricing/'

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
  id: RegistrySubscriptionTier
  key: CheckoutTierKey
  name: string
  pricing: TierPricing
  /** "What's included:" (Standard) or "Everything in {prev}, plus:". */
  featuresHeader: string
  features: string[]
  isPopular?: boolean
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
  fetchPlans,
  isTeamPlan,
  subscription,
  subscriptionStatus,
  teamCreditStops,
  currentTeamCreditStop
} = useBillingContext()

const canSelectPersonalPlan = computed(
  () => !isTeamPlan.value || canDowngradeToPersonal.value
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

const {
  updatePayment,
  isUpdatingPayment,
  paymentRecoveryLock,
  refreshCapabilities
} = usePaymentRecoveryDialog()
const updatePaymentButtonEl = ref<HTMLElement | null>(null)
const showPastDueNotice = computed(
  () => isCloud && paymentRecoveryLock.value !== null
)
const isOwnerNotice = computed(() => paymentRecoveryLock.value === 'owner')
watch(
  () => outstandingPaymentRefusals,
  async () => {
    await refreshCapabilities()
    await nextTick()
    updatePaymentButtonEl.value?.focus()
  }
)

const isCancelled = computed(() => subscription.value?.isCancelled ?? false)
const scheduledPlanChange = useScheduledPlanChange()
const showScheduledPlanChange = computed(
  () => scheduledPlanChange.isDisplayable.value && !isCancelled.value
)

// An ended subscription still reports its plan slug and tier, so the plan it
// held must not read as current — it is buyable again.
const isEnded = computed(() => subscriptionStatus.value === 'ended')

// An active current plan has nothing to transition to, which describes the card
// rather than the actor's permission — so it stays a client-side check while
// permission comes from lifecycleActionPermitted.
const offersTransition = (isCurrent: boolean): boolean =>
  !isCurrent || isCancelled.value

const currentBillingCycle = ref<BillingCycle>('yearly')

const isYearly = computed(() => currentBillingCycle.value === 'yearly')

const amountForCurrentCycle = (monthlyAmount: number) =>
  amountForBillingCycle(monthlyAmount, isYearly.value)

const creditsLabelKey = computed(() =>
  isYearly.value ? 'subscription.yearlyCredits' : 'subscription.monthlyCredits'
)

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
const teamCreditsForCurrentCycle = computed(() =>
  amountForCurrentCycle(selectedTeamStop.value.credits)
)
const teamVideoEstimate = computed(() =>
  Math.round(teamCreditsForCurrentCycle.value * VIDEO_PER_CREDIT)
)

// The team's currently-subscribed stop (null when on no team plan). Matched to
// the slider stops by list price so the current stop can be disabled.
const isTeamSubscribed = computed(
  () => currentTeamCreditStop.value !== null && !isEnded.value
)

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
    isLoading ||
    !offersTransition(
      isTeamSubscribed.value && isTeamCurrentPlanSelected.value
    ) ||
    !lifecycleActionPermitted.value
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

const creditsForTier = (tier: PricingTierConfig): number =>
  getApiPlanForTier(tier.key, currentBillingCycle.value)?.credits ??
  amountForCurrentCycle(tier.pricing.credits)

const videoEstimateForTier = (tier: PricingTierConfig): number =>
  Math.round(
    creditsForTier(tier) * (tier.pricing.videoEstimate / tier.pricing.credits)
  )

const getPlanAction = (tierKey: CheckoutTierKey): PlanAction =>
  getApiPlanForTier(tierKey, currentBillingCycle.value)?.action ?? 'none'

const isSamePlan = (tierKey: CheckoutTierKey): boolean =>
  getApiPlanForTier(tierKey, currentBillingCycle.value)?.denied_reason ===
  'same_plan'

const PLAN_ACTION_LABEL_KEYS: Readonly<
  Record<Exclude<PlanAction, 'none'>, string>
> = {
  subscribe: 'subscription.subscribeTo',
  change: 'subscription.changeTo',
  downgrade: 'subscription.changeTo',
  reactivate: 'subscription.resubscribeTo'
}

const DENIED_REASON_COPY_KEYS: Readonly<Record<string, string>> = {
  not_a_member: 'subscription.planUnavailable.notAMember',
  not_workspace_owner: 'subscription.planUnavailable.notWorkspaceOwner',
  not_original_owner: 'subscription.planUnavailable.notOriginalOwner',
  sales_managed: 'subscription.planUnavailable.salesManaged',
  billing_operation_parked:
    'subscription.planUnavailable.billingOperationParked',
  billing_operation_in_progress:
    'subscription.planUnavailable.billingOperationInProgress',
  annual_to_monthly_unsupported:
    'subscription.planUnavailable.annualToMonthlyUnsupported',
  incompatible_transition:
    'subscription.planUnavailable.incompatibleTransition',
  exceeds_max_seats: 'subscription.planUnavailable.exceedsMaxSeats',
  billing_state_unknown: 'subscription.planUnavailable.billingStateUnknown'
}

const getButtonLabel = (tier: PricingTierConfig): string => {
  const planName =
    currentBillingCycle.value === 'yearly'
      ? t('subscription.tierNameYearly', { name: tier.name })
      : tier.name
  if (isSamePlan(tier.key)) return t('subscription.currentPlan')
  const action = getPlanAction(tier.key)
  if (action === 'none') return planName
  return t(PLAN_ACTION_LABEL_KEYS[action], { plan: planName })
}

const getDeniedReasonCopy = (tierKey: CheckoutTierKey): string | undefined => {
  const plan = getApiPlanForTier(tierKey, currentBillingCycle.value)
  if (plan?.action !== 'none' || plan.denied_reason === 'same_plan') {
    return undefined
  }
  if (plan.denied_reason === 'subscription_change_in_progress') {
    const date = formatSubscriptionDate(
      plan.denied_reason_params?.effective_at,
      locale.value
    )
    return date
      ? t('subscription.planUnavailable.subscriptionChangeScheduled', { date })
      : t('subscription.planUnavailable.subscriptionChangeInProgress')
  }
  const key = plan.denied_reason && DENIED_REASON_COPY_KEYS[plan.denied_reason]
  return t(key || 'subscription.planUnavailable.generic')
}

const getButtonSeverity = (
  tier: PricingTierConfig
): 'primary' | 'secondary' => {
  if (getPlanAction(tier.key) === 'reactivate') return 'primary'
  if (isSamePlan(tier.key)) return 'secondary'
  if (tier.key === 'creator') return 'primary'
  return 'secondary'
}

const isButtonDisabled = (tier: PricingTierConfig): boolean =>
  isLoading || getPlanAction(tier.key) === 'none'

const getButtonTextClass = (tier: PricingTierConfig): string =>
  tier.key === 'creator'
    ? 'font-inter text-sm font-bold leading-normal text-background'
    : 'font-inter text-sm font-bold leading-normal text-foreground'

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
  const action = getPlanAction(tierKey)
  if (action === 'none') return
  if (action === 'reactivate') {
    emit('resubscribe')
    return
  }
  emit('subscribe', { tierKey, billingCycle: currentBillingCycle.value })
}

function handleSubscribeTeam() {
  if (isTeamButtonDisabled.value) return
  // Re-subscribe only when keeping the exact current plan; any other stop or
  // cycle is a change. An ended subscription still reports its credit stop, so
  // the stop alone is no proof there is a subscription left to resume.
  if (
    isTeamSubscribed.value &&
    isCancelled.value &&
    isTeamCurrentPlanSelected.value
  ) {
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
        currentBillingCycle.value
      ),
      periodChargeUsd: stop.periodChargeUsd
    },
    billingCycle: currentBillingCycle.value,
    isChange: isTeamPlanChange.value
  })
}

function handleViewEnterprise() {
  window.open(ENTERPRISE_URL, '_blank')
}
</script>
