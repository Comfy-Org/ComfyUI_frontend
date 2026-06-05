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
  TEAM_PLAN_CREDIT_STOPS
} from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { CreditStop } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'

const { disabled = false, class: rootClass } = defineProps<{
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  /** Fired when the selected stop changes, with the full derived payload. */
  change: [stop: { index: number; usd: number; credits: number }]
}>()

/** v-model carries the selected USD value (one of the TEAM_PLAN_CREDIT_STOPS). */
const usd = defineModel<number>({
  default: TEAM_PLAN_CREDIT_STOPS[DEFAULT_TEAM_PLAN_STOP_INDEX].usd
})

const selectedIndex = computed(() => {
  const i = TEAM_PLAN_CREDIT_STOPS.findIndex((stop) => stop.usd === usd.value)
  return i === -1 ? DEFAULT_TEAM_PLAN_STOP_INDEX : i
})

const current = computed<CreditStop>(
  () => TEAM_PLAN_CREDIT_STOPS[selectedIndex.value]
)

// Yearly commitment (per DES-197): the discount applies to the monthly figure.
// The card shows the discounted monthly price, the struck pre-discount price,
// the saving, and the annual total.
const discountedMonthly = computed(() =>
  Math.round(
    current.value.usd * (1 - current.value.discountPercentYearly / 100)
  )
)
const saveAmount = computed(() => current.value.usd - discountedMonthly.value)
const hasDiscount = computed(() => current.value.discountPercentYearly > 0)

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
    const stop = TEAM_PLAN_CREDIT_STOPS[index]
    if (!stop) return
    usd.value = stop.usd
    emit('change', { index, usd: stop.usd, credits: stop.credits })
  }
})

const lastIndex = TEAM_PLAN_CREDIT_STOPS.length - 1

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
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="flex items-baseline gap-1.5">
          <span
            class="text-[2rem] leading-none font-semibold text-base-foreground"
            data-testid="credit-slider-price"
          >
            {{ formatUsd(displayMonthly) }}
          </span>
          <span
            v-if="hasDiscount"
            class="text-base text-muted-foreground line-through"
            data-testid="credit-slider-original-price"
          >
            {{ formatUsd(displayOriginal) }}
          </span>
          <span class="text-base text-muted-foreground">
            {{ t('subscription.usdPerMonth') }}
          </span>
        </span>
        <!-- Save badge: outlined primary pill, pushed to the right (DES-197) -->
        <span
          v-if="hasDiscount"
          data-testid="credit-slider-save"
          class="ms-auto shrink-0 rounded-full border-2 border-primary-background px-2 py-1 text-sm font-bold whitespace-nowrap text-primary-background"
        >
          {{
            t('subscription.creditSliderSave', {
              percent: current.discountPercentYearly,
              amount: formatUsd(saveAmount)
            })
          }}
        </span>
      </div>
      <p
        class="m-0 text-sm text-muted-foreground"
        data-testid="credit-slider-billed-yearly"
      >
        {{
          t('subscription.billedYearly', {
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
    />

    <!-- Credit stop labels; the selected stop is emphasized -->
    <ol
      data-testid="credit-slider-stops"
      class="m-0 flex list-none justify-between p-0"
    >
      <li
        v-for="(stop, i) in TEAM_PLAN_CREDIT_STOPS"
        :key="stop.usd"
        :data-selected="i === selectedIndex ? '' : undefined"
        :class="
          cn(
            'flex items-center gap-1 text-xs',
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
