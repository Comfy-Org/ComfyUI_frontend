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
        <Switch v-model="billedYearly" />
        <span class="text-sm font-semibold text-base-foreground">
          {{ t('settingsPlans.billedYearlyToggle') }}
        </span>
        <span
          class="rounded-full bg-base-foreground px-2 py-0.5 text-2xs font-bold text-base-background"
        >
          {{ t('subscription.saveYearly') }}
        </span>
      </div>
    </div>

    <div
      v-if="audience === 'personal'"
      class="flex flex-col items-stretch gap-4 xl:flex-row"
    >
      <div
        v-for="plan in plans"
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
              ${{ billedYearly ? plan.pricing.yearly : plan.pricing.monthly }}
            </span>
            <span class="text-base text-muted-foreground">
              {{ t('subscription.usdPerMonth') }}
            </span>
          </div>
          <span class="text-sm text-muted-foreground tabular-nums">
            {{
              billedYearly
                ? t('subscription.billedYearly', {
                    total: `$${plan.pricing.yearly * 12}`
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
                  {{
                    n(
                      billedYearly
                        ? plan.pricing.credits * 12
                        : plan.pricing.credits
                    )
                  }}
                </span>
              </template>
            </I18nT>
          </div>
          <span class="text-sm text-muted-foreground tabular-nums">
            {{ t('settingsPlans.perDollar', { credits: perDollar(plan) }) }}
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

        <Button
          variant="secondary"
          size="lg"
          class="mt-auto w-full"
          :disabled="isCurrentPlan(plan.key) || isSubscribing"
          @click="subscribeToPersonal(plan.key, selectedCycle)"
        >
          {{
            isCurrentPlan(plan.key)
              ? t('subscription.currentPlan')
              : t('settingsPlans.choosePlan', { tier: plan.name })
          }}
        </Button>
      </div>
    </div>

    <template v-else>
      <div
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

          <Button
            variant="secondary"
            size="lg"
            class="mt-auto w-full"
            :disabled="isTeamCurrentPlan || isSubscribing"
            @click="subscribeToTeam(selectedTeamStop, selectedCycle)"
          >
            {{
              isTeamCurrentPlan
                ? t('subscription.teamPlan.currentPlan')
                : billedYearly
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
        <Button variant="secondary" size="lg">
          {{ t('settingsPlans.contactUs') }}
        </Button>
      </div>
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ t('settingsPlans.checkoutCaption') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import Button from '@/components/ui/button/Button.vue'
import CreditSlider from '@/components/ui/credit-slider/CreditSlider.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import { useBillingPlans } from '@/platform/cloud/subscription/composables/useBillingPlans'
import {
  DEFAULT_TEAM_PLAN_STOP_INDEX,
  TEAM_PLAN_CREDIT_STOPS,
  getTeamPlanSlug,
  mapApiTeamCreditStops
} from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { TIER_PRICING } from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierPricing } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { useSettingsPlansCheckout } from '@/platform/workspace/composables/useSettingsPlansCheckout'
import { findPlanSlug } from '@/platform/workspace/composables/useSubscriptionCheckout'
import type { CheckoutTierKey } from '@/platform/workspace/composables/useSubscriptionCheckout'

interface PlanCard {
  key: CheckoutTierKey
  name: string
  pricing: TierPricing
  benefits: string[]
  everythingIn?: string
}

const { t, n } = useI18n()

const audience = ref<'personal' | 'teams'>('personal')
// Re-clicking the active item makes the reka-ui toggle group emit an empty
// value; the section always shows one audience, so ignore deselection.
const audienceModel = computed({
  get: () => audience.value,
  set: (value: string) => {
    if (value === 'personal' || value === 'teams') audience.value = value
  }
})
const billedYearly = ref(true)

const plans = computed<PlanCard[]>(() => [
  {
    key: 'standard',
    name: t('subscription.tiers.standard.name'),
    pricing: TIER_PRICING.standard,
    benefits: [
      t('subscription.tiers.standard.feature1'),
      t('subscription.tiers.standard.feature2')
    ]
  },
  {
    key: 'creator',
    name: t('subscription.tiers.creator.name'),
    pricing: TIER_PRICING.creator,
    benefits: [t('subscription.tiers.creator.feature1')],
    everythingIn: t('subscription.tiers.standard.name')
  },
  {
    key: 'pro',
    name: t('subscription.tiers.pro.name'),
    pricing: TIER_PRICING.pro,
    benefits: [t('subscription.tiers.pro.feature1')],
    everythingIn: t('subscription.tiers.creator.name')
  }
])

function perDollar(plan: PlanCard): number {
  const price = billedYearly.value ? plan.pricing.yearly : plan.pricing.monthly
  return Math.round(plan.pricing.credits / price)
}

const VIDEO_PER_CREDIT =
  TIER_PRICING.pro.videoEstimate / TIER_PRICING.pro.credits

// Team stops mirror UnifiedPricingTable: backend-sourced when the shared plans
// state has them, DES-197 fallback otherwise.
const { teamCreditStops } = useBillingPlans()
const { fetchPlans, plans: catalogPlans, currentPlanSlug } = useBillingContext()
const { isSubscribing, subscribeToPersonal, subscribeToTeam } =
  useSettingsPlansCheckout()

onMounted(() => {
  void fetchPlans()
})

const selectedCycle = computed<BillingCycle>(() =>
  billedYearly.value ? 'yearly' : 'monthly'
)

// True only when the tier's catalog slug is the current plan. A founder or
// legacy slug matches no rendered card, so every card stays actionable.
function isCurrentPlan(tierKey: CheckoutTierKey): boolean {
  return (
    currentPlanSlug.value !== null &&
    findPlanSlug(catalogPlans.value, tierKey, selectedCycle.value) ===
      currentPlanSlug.value
  )
}

const isTeamCurrentPlan = computed(
  () => currentPlanSlug.value === getTeamPlanSlug(selectedCycle.value)
)

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

const teamUsd = ref(defaultTeamStop.value.usd)
const selectedTeamStop = computed(
  () =>
    teamStops.value.find((stop) => stop.usd === teamUsd.value) ??
    defaultTeamStop.value
)

// API stops can resolve after mount with different breakpoints, leaving the
// seeded slider USD matching no stop; snap it to the resolved default.
watch(defaultTeamStop, (stop) => {
  if (teamStops.value.some((s) => s.usd === teamUsd.value)) return
  teamUsd.value = stop.usd
})
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
