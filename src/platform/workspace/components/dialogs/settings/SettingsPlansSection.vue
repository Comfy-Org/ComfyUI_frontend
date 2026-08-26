<template>
  <section class="flex shrink-0 flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h3 class="m-0 text-base font-semibold text-base-foreground">
        {{ t('settingsPlans.title') }}
      </h3>
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('settingsPlans.subtitle') }}
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <ToggleGroup v-model="audienceModel" type="single" variant="outline">
        <ToggleGroupItem value="personal">
          {{ t('settingsPlans.personal') }}
        </ToggleGroupItem>
        <ToggleGroupItem value="teams">
          {{ t('settingsPlans.teams') }}
        </ToggleGroupItem>
      </ToggleGroup>

      <div class="flex items-center gap-2">
        <Switch
          v-model="billedYearly"
          :aria-label="t('settingsPlans.billedYearlyToggle')"
        />
        <span class="text-sm font-semibold text-base-foreground">
          {{ t('settingsPlans.billedYearlyToggle') }}
        </span>
      </div>
    </div>

    <!-- A refetch that failed leaves the previous catalog on screen; keep it
         (re-rendering into an empty section would be worse) but say so and
         offer the retry, or the failure is invisible. -->
    <div
      v-if="hasStaleError"
      class="flex flex-wrap items-center gap-3 rounded-2xl border border-interface-stroke px-4 py-3"
      role="alert"
    >
      <div class="flex min-w-0 items-center gap-2 text-text-secondary">
        <i class="pi pi-exclamation-circle text-danger" aria-hidden="true" />
        <span class="text-sm">{{ t('subscription.planLoadErrorStale') }}</span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        class="ml-auto rounded-lg px-4 text-sm font-normal"
        @click="emit('retry')"
      >
        {{ t('subscription.planLoadErrorRetry') }}
      </Button>
    </div>

    <!-- Loading: never render a frontend-authored price while the catalog is in
         flight; a spinner stands in for the offer. -->
    <div
      v-if="isLoading && !personalCards.length"
      class="flex items-center gap-2 py-8 text-muted-foreground"
    >
      <i class="pi pi-spin pi-spinner" />
      <span class="text-sm">{{ t('g.loading') }}</span>
    </div>

    <!-- Personal -->
    <div
      v-else-if="audience === 'personal'"
      class="flex flex-col items-stretch gap-4 xl:flex-row"
    >
      <div
        v-for="plan in personalCards"
        :key="plan.key"
        class="flex flex-1 flex-col gap-4 rounded-2xl border border-interface-stroke p-6"
      >
        <span class="text-base font-bold text-base-foreground">
          {{ plan.name }}
        </span>

        <div class="flex flex-col gap-1">
          <div class="flex items-baseline gap-2">
            <span
              class="text-[28px] leading-normal font-semibold text-base-foreground tabular-nums"
            >
              ${{ n(plan.pricePerMonth, { maximumFractionDigits: 2 }) }}
            </span>
            <span class="text-base text-muted-foreground">
              {{ t('subscription.usdPerMonth') }}
            </span>
          </div>
          <span class="text-sm text-muted-foreground tabular-nums">
            {{
              billedYearly
                ? t('subscription.billedYearly', {
                    total: `$${n(plan.billedYearlyTotal)}`
                  })
                : t('subscription.billedMonthly')
            }}
          </span>
        </div>

        <div class="border-t border-interface-stroke" />

        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-1.5">
            <i
              class="icon-[lucide--coins] size-4 shrink-0 bg-credit"
              aria-hidden="true"
            />
            <I18nT
              :keypath="
                billedYearly
                  ? 'settingsPlans.creditsAYear'
                  : 'settingsPlans.creditsAMonth'
              "
              tag="span"
              class="text-sm text-base-foreground"
            >
              <template #credits>
                <span class="font-bold tabular-nums">
                  {{ n(plan.credits) }}
                </span>
              </template>
            </I18nT>
          </div>
          <span class="text-sm text-muted-foreground tabular-nums">
            {{ t('settingsPlans.perDollar', { credits: plan.perDollar }) }}
          </span>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{
              plan.everythingIn
                ? t('subscription.everythingInPlus', {
                    plan: plan.everythingIn
                  })
                : t('subscription.whatsIncluded')
            }}
          </span>
          <div
            v-for="benefit in plan.benefits"
            :key="benefit"
            class="flex items-center gap-2"
          >
            <i class="pi pi-check text-xs text-base-foreground" />
            <span class="text-sm text-base-foreground">{{ benefit }}</span>
          </div>
        </div>

        <Button variant="secondary" size="lg" disabled class="mt-auto w-full">
          {{ t('settingsPlans.choosePlan', { tier: plan.name }) }}
        </Button>
      </div>

      <!-- No personal catalog rows: an offer we cannot source is not shown. -->
      <PlansUnavailable
        v-if="!personalCards.length"
        :variant="unavailableVariant"
        @retry="emit('retry')"
      />
    </div>

    <!-- Teams -->
    <template v-else>
      <div
        v-if="hasTeamStops"
        class="flex flex-col rounded-2xl border border-interface-stroke xl:flex-row"
      >
        <div class="flex flex-1 flex-col gap-4 p-6">
          <div class="flex flex-col gap-1">
            <span class="text-base font-bold text-base-foreground">
              {{ t('subscription.teamPlan.name') }}
            </span>
            <p class="m-0 max-w-md text-sm text-muted-foreground">
              {{ t('subscription.teamPlan.tagline') }}
            </p>
          </div>

          <CreditSlider
            v-model="teamUsd"
            :stops="teamStops"
            :default-stop-index="teamDefaultStopIndex"
            :cycle="billedYearly ? 'yearly' : 'monthly'"
          />

          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-1.5">
              <i
                class="icon-[lucide--coins] size-4 shrink-0 bg-credit"
                aria-hidden="true"
              />
              <I18nT
                keypath="settingsPlans.creditsPerMonth"
                tag="span"
                class="text-sm text-base-foreground"
              >
                <template #credits>
                  <span class="font-bold tabular-nums">
                    {{ n(selectedTeamStop.credits) }}
                  </span>
                </template>
              </I18nT>
            </div>
            <span class="text-sm text-muted-foreground">
              {{
                t('subscription.videoEstimate', {
                  count: n(teamVideoEstimate)
                })
              }}
            </span>
          </div>

          <Button variant="secondary" size="lg" disabled class="mt-auto w-full">
            {{
              billedYearly
                ? t('subscription.teamPlan.cta')
                : t('subscription.teamPlan.ctaMonthly')
            }}
          </Button>
        </div>

        <div
          class="h-px w-full shrink-0 self-stretch bg-interface-stroke xl:h-auto xl:w-px"
        />

        <div class="flex flex-col gap-3 p-6 xl:w-80">
          <span class="text-base font-semibold text-base-foreground">
            {{ t('subscription.teamPlan.detailsTitle') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{
              t('subscription.everythingInPlus', {
                plan: t('subscription.tiers.pro.name')
              })
            }}
          </span>
          <div
            v-for="perk in teamPerks"
            :key="perk"
            class="flex items-start gap-2"
          >
            <i class="pi pi-check mt-0.5 text-xs text-base-foreground" />
            <span class="text-sm text-base-foreground">{{ perk }}</span>
          </div>
          <span class="text-sm text-muted-foreground">
            {{ t('subscription.teamPlan.comingSoonLabel') }}
          </span>
          <div
            v-for="item in teamComingSoon"
            :key="item"
            class="flex items-start gap-2"
          >
            <i class="pi pi-clock mt-0.5 text-xs text-muted-foreground" />
            <span class="text-sm text-muted-foreground">{{ item }}</span>
          </div>
        </div>
      </div>

      <!-- No team stops in the catalog: explicit unavailable state, never a
           constant-seeded slider. -->
      <PlansUnavailable
        v-else
        :variant="unavailableVariant"
        @retry="emit('retry')"
      />

      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-interface-stroke px-6 py-4"
      >
        <div class="flex items-center gap-4">
          <span
            class="text-2xs font-bold tracking-widest text-credit uppercase"
          >
            {{ t('subscription.enterprise.name') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ t('settingsPlans.enterpriseCopy') }}
          </span>
        </div>
        <Button variant="secondary" size="lg" disabled>
          {{ t('subscription.contactUs') }}
        </Button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import CreditSlider from '@/components/ui/credit-slider/CreditSlider.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import { mapApiTeamCreditStops } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { VIDEO_PER_CREDIT } from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  Plan,
  TeamCreditStops
} from '@/platform/workspace/api/workspaceApi'

import PlansUnavailable from './PlansUnavailable.vue'

// The API catalog is the source of truth for every rendered price, credit,
// slug, and stop; the frontend holds only presentation copy. A missing or
// incomplete catalog renders the unavailable state, never a constant.
const {
  catalogPlans = [],
  teamCreditStops = null,
  isLoading = false,
  error = null
} = defineProps<{
  catalogPlans?: Plan[]
  teamCreditStops?: TeamCreditStops | null
  isLoading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{ retry: [] }>()

// A load failure is retryable ('error'); a catalog that loaded with no plans is
// a successful empty result ('empty', no retry).
const unavailableVariant = computed<'empty' | 'error'>(() =>
  error ? 'error' : 'empty'
)

const { t, n } = useI18n()

const audience = ref<'personal' | 'teams'>('personal')
const audienceModel = computed({
  get: () => audience.value,
  set: (value: string) => {
    if (value === 'personal' || value === 'teams') audience.value = value
  }
})
const billedYearly = ref(true)

interface PersonalTier {
  key: string
  tier: Plan['tier']
  name: string
  benefits: string[]
  everythingIn?: string
}

interface PersonalCard extends PersonalTier {
  slug: string
  available: boolean
  pricePerMonth: number
  billedYearlyTotal: number
  credits: number
  perDollar: number
}

// Presentation-only tier metadata; price/credits/slug come from the API row.
const personalTiers = computed<PersonalTier[]>(() => [
  {
    key: 'standard',
    tier: 'STANDARD',
    name: t('subscription.tiers.standard.name'),
    benefits: [
      t('subscription.tiers.standard.feature1'),
      t('subscription.tiers.standard.feature2')
    ]
  },
  {
    key: 'creator',
    tier: 'CREATOR',
    name: t('subscription.tiers.creator.name'),
    benefits: [t('subscription.tiers.creator.feature1')],
    everythingIn: t('subscription.tiers.standard.name')
  },
  {
    key: 'pro',
    tier: 'PRO',
    name: t('subscription.tiers.pro.name'),
    benefits: [t('subscription.tiers.pro.feature1')],
    everythingIn: t('subscription.tiers.creator.name')
  }
])

function findApiPlan(tier: Plan['tier']): Plan | undefined {
  const duration = billedYearly.value ? 'ANNUAL' : 'MONTHLY'
  return catalogPlans.find((p) => p.tier === tier && p.duration === duration)
}

const personalCards = computed<PersonalCard[]>(() =>
  personalTiers.value.flatMap((tier) => {
    const plan = findApiPlan(tier.tier)
    if (!plan) return []
    // Annual price_cents is the full-year total; per-month is /12.
    const periodPrice = plan.price_cents / 100
    const pricePerMonth = billedYearly.value ? periodPrice / 12 : periodPrice
    return [
      {
        ...tier,
        slug: plan.slug,
        available: plan.availability.available,
        pricePerMonth,
        billedYearlyTotal: periodPrice,
        credits: plan.credits_cents,
        perDollar:
          periodPrice > 0 ? Math.round(plan.credits_cents / periodPrice) : 0
      }
    ]
  })
)

// An error alongside a non-empty catalog means a refetch failed over cached
// rows; the unavailable block never renders then, so the banner is the only
// place that failure can surface.
const hasStaleError = computed(
  () => Boolean(error) && personalCards.value.length > 0
)

// Team stops come from the API only — no TEAM_PLAN_CREDIT_STOPS fallback (D3).
const teamStops = computed(() => {
  const apiStops = teamCreditStops?.stops
  return apiStops?.length ? mapApiTeamCreditStops(apiStops) : []
})
const hasTeamStops = computed(() => teamStops.value.length > 0)
const teamDefaultStopIndex = computed(
  () => teamCreditStops?.default_stop_index ?? 0
)
const defaultTeamStop = computed(
  () => teamStops.value[teamDefaultStopIndex.value] ?? teamStops.value[0]
)

const teamUsd = ref(defaultTeamStop.value?.usd ?? 0)
const selectedTeamStop = computed(
  () =>
    teamStops.value.find((stop) => stop.usd === teamUsd.value) ??
    defaultTeamStop.value ?? {
      id: undefined,
      usd: 0,
      credits: 0,
      discountPercentYearly: 0
    }
)

// No re-snap watch needed: when the seeded teamUsd matches no live stop,
// both selectedTeamStop and CreditSlider's selectedIndex fall back to the
// default stop, so the display and slider stay correct as stops resolve.

const teamVideoEstimate = computed(() =>
  Math.round(selectedTeamStop.value.credits * VIDEO_PER_CREDIT)
)

const teamPerks = computed(() => [
  t('subscription.teamPlan.perkInviteMembers'),
  t('subscription.teamPlan.perkConcurrentRuns'),
  t('subscription.teamPlan.perkSharedPool'),
  t('subscription.teamPlan.perkRolePermissions')
])
const teamComingSoon = computed(() => [
  t('settingsPlans.comingSharedWorkflows'),
  t('settingsPlans.comingProjects')
])
</script>
