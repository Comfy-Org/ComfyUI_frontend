<script setup lang="ts">
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

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
const formatNumber = (value: number) => value.toLocaleString('en-US')
</script>

<template>
  <div :class="cn('flex w-full flex-col gap-3', rootClass)">
    <!-- Live selection -->
    <div class="flex items-baseline justify-between">
      <span class="text-2xl font-semibold text-base-foreground">
        ${{ formatNumber(current.usd) }}
        <span class="text-sm font-normal text-muted-foreground">/ month</span>
      </span>
      <span class="flex items-center gap-1 text-sm text-secondary-foreground">
        <i
          class="icon-[comfy--credits] size-4 bg-amber-400"
          aria-hidden="true"
        />
        {{ formatNumber(current.credits) }} credits
      </span>
    </div>

    <!-- Discrete slider: snaps to the 5 fixed DES-197 stops -->
    <Slider
      v-model="sliderModel"
      :min="0"
      :max="lastIndex"
      :step="1"
      :disabled="disabled"
    />

    <!-- Stop labels; the selected stop is emphasized -->
    <div
      data-testid="credit-slider-stops"
      class="flex justify-between text-xxs text-muted-foreground"
    >
      <span
        v-for="(stop, i) in TEAM_PLAN_CREDIT_STOPS"
        :key="stop.usd"
        :class="cn(i === selectedIndex && 'font-semibold text-base-foreground')"
      >
        ${{ formatNumber(stop.usd) }}
      </span>
    </div>
  </div>
</template>
