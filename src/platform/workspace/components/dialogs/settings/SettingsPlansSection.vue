<template>
  <!-- No catalog rows means no offer to show: the fetch lands in a later slice. -->
  <section v-if="personalCards.length" class="flex shrink-0 flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h3 class="m-0 text-base font-semibold text-base-foreground">
        {{ t('settingsPlans.title') }}
      </h3>
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('settingsPlans.subtitle') }}
      </p>
    </div>

    <div class="flex items-center justify-end">
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

    <div class="flex flex-col items-stretch gap-4 xl:flex-row">
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
          <span class="text-sm text-muted-foreground">
            {{
              t('subscription.videoEstimate', { count: n(plan.videoEstimate) })
            }}
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
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import type { Plan } from '@/platform/workspace/api/workspaceApi'

// The API catalog is the source of truth for personal price/credits/slug/tier;
// the frontend holds only presentation copy. Supplied by the fetch in a later
// slice — empty until then, so no card renders a frontend-authored offer.
const { catalogPlans = [] } = defineProps<{
  catalogPlans?: Plan[]
}>()

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
  videoEstimate: number
}

const { t, n } = useI18n()

const billedYearly = ref(true)

// Videos generated per credit for the Wan 2.2 i2v template — a fixed, disclosed
// presentation ratio (the copy carries the "*" template caveat). Applied to the
// API credit grant so the estimate tracks what is sold and cannot drift.
const VIDEO_PER_CREDIT = 0.0908

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

// A tier with no matching catalog row renders no card: an offer we cannot
// source from the API is never shown.
const personalCards = computed<PersonalCard[]>(() =>
  personalTiers.value.flatMap((tier) => {
    const plan = findApiPlan(tier.tier)
    if (!plan) return []
    // Annual price_cents is the full-year total; per-month is /12.
    const periodPrice = plan.price_cents / 100
    const pricePerMonth = billedYearly.value ? periodPrice / 12 : periodPrice
    // The video estimate is a per-month figure; annual credits_cents is the
    // yearly grant, so scale it down to a month before applying the ratio.
    const monthlyCredits = billedYearly.value
      ? plan.credits_cents / 12
      : plan.credits_cents
    return [
      {
        ...tier,
        slug: plan.slug,
        available: plan.availability.available,
        pricePerMonth,
        billedYearlyTotal: periodPrice,
        // Annual credits_cents is already the yearly total (not monthly).
        credits: plan.credits_cents,
        perDollar:
          periodPrice > 0 ? Math.round(plan.credits_cents / periodPrice) : 0,
        videoEstimate: Math.round(monthlyCredits * VIDEO_PER_CREDIT)
      }
    ]
  })
)
</script>
