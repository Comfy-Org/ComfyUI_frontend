<template>
  <section class="flex shrink-0 flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h3 class="m-0 text-base font-semibold text-base-foreground">
        {{ $t('settingsPlans.title') }}
      </h3>
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('settingsPlans.subtitle') }}
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <ToggleGroup v-model="audience" type="single" variant="outline">
        <ToggleGroupItem value="personal">
          {{ $t('settingsPlans.personal') }}
        </ToggleGroupItem>
        <ToggleGroupItem value="teams">
          {{ $t('settingsPlans.teams') }}
        </ToggleGroupItem>
      </ToggleGroup>

      <div class="flex items-center gap-2">
        <Switch v-model="billedYearly" />
        <span class="text-sm font-semibold text-base-foreground">
          {{ $t('settingsPlans.billedYearlyToggle') }}
        </span>
        <span
          class="rounded-full bg-base-foreground px-2 py-0.5 text-2xs font-bold text-base-background"
        >
          {{ $t('subscription.saveYearly') }}
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
              {{ $t('subscription.usdPerMonth') }}
            </span>
          </div>
          <span class="text-sm text-muted-foreground tabular-nums">
            {{
              billedYearly
                ? $t('settingsPlans.billedYearlyTotal', {
                    total: `$${plan.pricing.yearly * 12}`
                  })
                : $t('settingsPlans.billedMonthly')
            }}
          </span>
        </div>

        <div class="border-t border-interface-stroke" />

        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-1.5">
            <i
              class="icon-[comfy--credits] size-4 shrink-0 bg-credit"
              aria-hidden="true"
            />
            <i18n-t
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
                    $n(
                      billedYearly
                        ? plan.pricing.credits * 12
                        : plan.pricing.credits
                    )
                  }}
                </span>
              </template>
            </i18n-t>
          </div>
          <span class="text-sm text-muted-foreground tabular-nums">
            {{ $t('settingsPlans.perDollar', { credits: perDollar(plan) }) }}
          </span>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{
              plan.everythingIn
                ? $t('settingsPlans.everythingInPlus', {
                    tier: plan.everythingIn
                  })
                : $t('settingsPlans.whatsIncluded')
            }}
          </span>
          <div
            v-for="benefit in plan.benefits"
            :key="benefit"
            class="flex items-center gap-2"
          >
            <i class="pi pi-check text-success-foreground text-xs" />
            <span class="text-sm text-base-foreground">{{ benefit }}</span>
          </div>
        </div>

        <Button variant="secondary" size="lg" class="mt-auto w-full">
          {{ $t('settingsPlans.choosePlan', { tier: plan.name }) }}
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
              {{ $t('settingsPlans.teamTitle') }}
            </span>
            <p class="m-0 max-w-md text-sm text-muted-foreground">
              {{ $t('settingsPlans.teamSubtitle') }}
            </p>
          </div>

          <CreditSlider
            v-model="teamUsd"
            :cycle="billedYearly ? 'yearly' : 'monthly'"
          />

          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-1.5">
              <i
                class="icon-[comfy--credits] size-4 shrink-0 bg-credit"
                aria-hidden="true"
              />
              <i18n-t
                keypath="settingsPlans.creditsPerMonth"
                tag="span"
                class="text-sm text-base-foreground"
              >
                <template #credits>
                  <span class="font-bold tabular-nums">
                    {{ $n(selectedTeamStop.credits) }}
                  </span>
                </template>
              </i18n-t>
            </div>
            <span class="text-sm text-muted-foreground">
              {{
                $t('subscription.videoEstimate', {
                  count: $n(teamVideoEstimate)
                })
              }}
            </span>
          </div>

          <Button variant="secondary" size="lg" class="mt-auto w-full">
            {{
              billedYearly
                ? $t('settingsPlans.subscribeTeamYearly')
                : $t('settingsPlans.subscribeTeam')
            }}
          </Button>
        </div>

        <div
          class="h-px w-full shrink-0 self-stretch bg-interface-stroke xl:h-auto xl:w-px"
        />

        <div class="flex flex-col gap-3 p-6 xl:w-80">
          <span class="text-base font-semibold text-base-foreground">
            {{ $t('settingsPlans.detailsTitle') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ $t('settingsPlans.everythingInProPlus') }}
          </span>
          <div
            v-for="perk in teamPerks"
            :key="perk"
            class="flex items-start gap-2"
          >
            <i class="pi pi-check text-success-foreground mt-0.5 text-xs" />
            <span class="text-sm text-base-foreground">{{ perk }}</span>
          </div>
          <span class="text-sm text-muted-foreground">
            {{ $t('settingsPlans.comingSoonLabel') }}
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
            {{ $t('settingsPlans.enterpriseLabel') }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ $t('settingsPlans.enterpriseCopy') }}
          </span>
        </div>
        <Button variant="secondary" size="lg">
          {{ $t('settingsPlans.contactUs') }}
        </Button>
      </div>
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('settingsPlans.checkoutCaption') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import CreditSlider from '@/components/ui/credit-slider/CreditSlider.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import {
  DEFAULT_TEAM_PLAN_STOP_INDEX,
  TEAM_PLAN_CREDIT_STOPS
} from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { TIER_PRICING } from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierPricing } from '@/platform/cloud/subscription/constants/tierPricing'

interface PlanCard {
  key: string
  name: string
  pricing: TierPricing
  benefits: string[]
  everythingIn?: string
}

const { t } = useI18n()

const audience = ref('personal')
const billedYearly = ref(true)

const plans = computed<PlanCard[]>(() => [
  {
    key: 'standard',
    name: 'Standard',
    pricing: TIER_PRICING.standard,
    benefits: [
      t('settingsPlans.benefitRuntimeStandard'),
      t('settingsPlans.benefitAddCredits')
    ]
  },
  {
    key: 'creator',
    name: 'Creator',
    pricing: TIER_PRICING.creator,
    benefits: [t('settingsPlans.benefitImportModels')],
    everythingIn: 'Standard'
  },
  {
    key: 'pro',
    name: 'Pro',
    pricing: TIER_PRICING.pro,
    benefits: [t('settingsPlans.benefitRuntimePro')],
    everythingIn: 'Creator'
  }
])

function perDollar(plan: PlanCard): number {
  const price = billedYearly.value ? plan.pricing.yearly : plan.pricing.monthly
  return Math.round(plan.pricing.credits / price)
}

const VIDEO_PER_CREDIT =
  TIER_PRICING.standard.videoEstimate / TIER_PRICING.standard.credits

const teamUsd = ref(TEAM_PLAN_CREDIT_STOPS[DEFAULT_TEAM_PLAN_STOP_INDEX].usd)
const selectedTeamStop = computed(
  () =>
    TEAM_PLAN_CREDIT_STOPS.find((stop) => stop.usd === teamUsd.value) ??
    TEAM_PLAN_CREDIT_STOPS[DEFAULT_TEAM_PLAN_STOP_INDEX]
)
const teamVideoEstimate = computed(() =>
  Math.round(selectedTeamStop.value.credits * VIDEO_PER_CREDIT)
)

const teamPerks = computed(() => [
  t('settingsPlans.perkInviteMembers'),
  t('settingsPlans.perkConcurrentRuns'),
  t('settingsPlans.perkSharedCreditPool'),
  t('settingsPlans.perkRolePermissions')
])
const teamComingSoon = computed(() => [
  t('settingsPlans.comingSharedWorkflows'),
  t('settingsPlans.comingProjects')
])
</script>
