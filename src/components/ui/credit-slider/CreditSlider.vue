<script setup lang="ts">
import {
  TransitionPresets,
  usePreferredReducedMotion,
  useTransition
} from '@vueuse/core'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Slider from '@/components/ui/slider/Slider.vue'
import {
  DEFAULT_TEAM_PLAN_STOP_INDEX,
  TEAM_PLAN_CREDIT_STOPS,
  getStopDiscountedMonthlyUsd
} from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { CreditStop } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'

const {
  disabled = false,
  class: rootClass,
  stops = TEAM_PLAN_CREDIT_STOPS,
  defaultStopIndex = DEFAULT_TEAM_PLAN_STOP_INDEX,
  cycle = 'yearly'
} = defineProps<{
  disabled?: boolean
  class?: HTMLAttributes['class']
  /**
   * The fixed credit stops the slider snaps to. Must be non-empty. Defaults to
   * the hardcoded DES-197 set; pass the backend-sourced stops once the contract
   * lands — map `GET /api/billing/plans → team_credit_stops.stops` to
   * `CreditStop[]` (credits, the pre-discount `usd`, and `discountPercentYearly`).
   */
  stops?: readonly CreditStop[]
  /**
   * Stop selected when the bound value matches none (e.g. first render).
   * Maps to `team_credit_stops.default_stop_index`. Defaults to DES-197 ($700).
   */
  defaultStopIndex?: number
  /**
   * Billing cycle. Yearly applies the full `discountPercentYearly`; monthly
   * applies half of it (PRD: GA Team Billing — "for monthly the discount is
   * halved": yearly 0/5/10/15/20% → monthly 0/2.5/5/7.5/10%).
   */
  cycle?: 'monthly' | 'yearly'
}>()

const emit = defineEmits<{
  /** Fired when the selected stop changes, with the full derived payload. */
  change: [stop: { index: number; usd: number; credits: number }]
}>()

/**
 * v-model carries the selected USD value (one of the `stops`). The literal
 * default keeps `defineModel` statically analyzable; when custom `stops` are
 * passed without a matching v-model, `selectedIndex` falls back to
 * `defaultStopIndex`, so the displayed stop is still correct.
 */
const usd = defineModel<number>({
  default: TEAM_PLAN_CREDIT_STOPS[DEFAULT_TEAM_PLAN_STOP_INDEX].usd
})

const selectedIndex = computed(() => {
  const i = stops.findIndex((stop) => stop.usd === usd.value)
  if (i !== -1) return i
  // Fall back to the default stop, clamped into range: a backend-driven `stops`
  // array can be shorter than expected (or `defaultStopIndex` out of bounds), so
  // clamping keeps `current` defined and the price computeds below from reading
  // `undefined.usd` at runtime. (`stops` is required to be non-empty.)
  return Math.min(Math.max(defaultStopIndex, 0), Math.max(stops.length - 1, 0))
})

const current = computed<CreditStop>(() => stops[selectedIndex.value])

// The discount applies to the monthly figure. Yearly uses the full
// `discountPercentYearly`; monthly halves it (PRD: GA Team Billing). The card
// shows the discounted monthly price, the struck pre-discount price, the
// saving, and — for yearly — the annual total.
const effectiveDiscountPercent = computed(() =>
  cycle === 'monthly'
    ? current.value.discountPercentYearly / 2
    : current.value.discountPercentYearly
)
const discountedMonthly = computed(() =>
  getStopDiscountedMonthlyUsd(current.value, cycle)
)
const saveAmount = computed(() => current.value.usd - discountedMonthly.value)
const hasDiscount = computed(() => effectiveDiscountPercent.value > 0)

/**
 * Smoothly count the price figures up/down as the slider moves between stops
 * instead of snapping. Honors the user's reduced-motion preference. The save
 * badge ("X% ($Y)") is intentionally left snapping — its percent is a discrete
 * tier, so animating the bracketed amount alone would read inconsistently.
 */
const prefersReducedMotion = usePreferredReducedMotion()
const priceTween = {
  duration: 350,
  easing: TransitionPresets.easeOutCubic,
  disabled: computed(() => prefersReducedMotion.value === 'reduce')
}
const animatedMonthly = useTransition(discountedMonthly, priceTween)
const animatedOriginal = useTransition(() => current.value.usd, priceTween)

const displayMonthly = computed(() => Math.round(animatedMonthly.value))
const displayOriginal = computed(() => Math.round(animatedOriginal.value))
// Derive the yearly total from the displayed monthly so it always reads as
// exactly 12× the price shown — even mid-count — rather than drifting as a
// second, independently-phased tween would.
const displayBilledYearly = computed(() => displayMonthly.value * 12)

/**
 * Bridge the discrete stop index (0..n-1) to the reka-ui slider's `number[]`
 * model. Driving the slider in index space with `step = 1` guarantees the
 * thumb can only land on the fixed stops — never a value in between.
 */
const sliderModel = computed<number[]>({
  get: () => [selectedIndex.value],
  set: ([index]) => {
    const stop = stops[index]
    if (!stop) return
    usd.value = stop.usd
    emit('change', { index, usd: stop.usd, credits: stop.credits })
  }
})

const lastIndex = computed(() => Math.max(stops.length - 1, 0))

const formatUsd = (value: number) => `$${value.toLocaleString('en-US')}`
const formatCreditsCompact = (value: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)

const { t } = useI18n()
</script>

<template>
  <div :class="cn('flex w-full flex-col gap-3', rootClass)">
    <!-- Price: discounted monthly + struck pre-discount + save badge -->
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <span
            class="text-[2rem]/none font-semibold text-base-foreground tabular-nums"
            data-testid="credit-slider-price"
          >
            {{ formatUsd(displayMonthly) }}
          </span>
          <span
            v-if="hasDiscount"
            class="text-base text-muted-foreground tabular-nums line-through"
            data-testid="credit-slider-original-price"
          >
            {{ formatUsd(displayOriginal) }}
          </span>
          <span class="text-base text-muted-foreground">
            {{ t('subscription.usdPerMonth') }}
          </span>
        </span>
        <!-- Save badge: outlined primary pill. On wide layouts it's pushed to
             the right of the price; when the column narrows (mobile) it wraps
             and aligns left under the price instead (DES QA). -->
        <span
          v-if="hasDiscount"
          data-testid="credit-slider-save"
          class="shrink-0 rounded-full border-2 border-primary-background px-2 py-1 text-sm font-bold whitespace-nowrap text-primary-background xl:ms-auto"
        >
          {{
            t('subscription.creditSliderSave', {
              percent: effectiveDiscountPercent,
              amount: formatUsd(saveAmount)
            })
          }}
        </span>
      </div>
      <p
        class="m-0 text-sm text-muted-foreground tabular-nums"
        data-testid="credit-slider-billed-yearly"
      >
        {{
          cycle === 'monthly'
            ? t('subscription.billedMonthly')
            : t('subscription.billedYearly', {
                total: formatUsd(displayBilledYearly)
              })
        }}
      </p>
    </div>

    <!-- Discrete slider: snaps to the 5 fixed DES-197 stops -->
    <Slider
      v-model="sliderModel"
      :min="0"
      :max="lastIndex"
      :step="1"
      :disabled="disabled"
      range-class="bg-base-foreground"
      thumb-class="bg-base-foreground"
    />

    <!-- Credit stop labels; the selected stop is emphasized -->
    <ol
      data-testid="credit-slider-stops"
      class="m-0 flex list-none justify-between p-0"
    >
      <li
        v-for="(stop, i) in stops"
        :key="stop.usd"
        :data-selected="i === selectedIndex ? '' : undefined"
        :class="
          cn(
            'flex items-center gap-1 text-xs tabular-nums',
            i === selectedIndex
              ? 'font-semibold text-base-foreground'
              : 'text-muted-foreground'
          )
        "
      >
        <i
          :class="
            cn(
              'icon-[comfy--credits] size-3 shrink-0',
              i === selectedIndex ? 'bg-amber-400' : 'bg-muted-foreground'
            )
          "
          aria-hidden="true"
        />
        {{ formatCreditsCompact(stop.credits) }}
      </li>
    </ol>
  </div>
</template>
