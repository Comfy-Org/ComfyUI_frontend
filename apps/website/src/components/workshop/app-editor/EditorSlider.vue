<script setup lang="ts">
import { computed } from 'vue'

import InfoTooltip from '@/components/ui/tooltip/InfoTooltip.vue'

const {
  label,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  display,
  hint,
  disabled = false
} = defineProps<{
  label: string
  min?: number
  max?: number
  step?: number
  unit?: string
  /** The value as shown, when it reads better than the number and unit. */
  display?: string
  hint?: string
  disabled?: boolean
}>()

const value = defineModel<number>({ required: true })

const fill = computed(() => ((value.value - min) / (max - min || 1)) * 100)
const shown = computed(() => display ?? `${value.value}${unit}`)
</script>

<template>
  <div
    class="relative flex h-9 items-center justify-between overflow-hidden rounded-lg px-3 text-[13px] ring-1 ring-transparency-white-t8 ring-inset has-disabled:opacity-40 has-[input:focus-visible]:ring-primary-comfy-yellow/60"
  >
    <span
      class="absolute inset-y-0 left-0 bg-transparency-white-t8"
      :style="{ width: `${fill}%` }"
      aria-hidden="true"
    />
    <span
      class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary-warm-white"
      :style="{ left: `${fill}%` }"
      aria-hidden="true"
    />
    <span class="relative flex items-center gap-1.5 text-primary-comfy-canvas">
      {{ label }}
      <span
        v-if="hint"
        class="relative z-10 inline-flex rounded-full has-focus-visible:ring-2 has-focus-visible:ring-primary-comfy-yellow/60 has-focus-visible:ring-inset"
      >
        <InfoTooltip :text="hint" :label="hint" />
      </span>
    </span>
    <span class="relative font-mono text-primary-warm-white tabular-nums">
      {{ shown }}
    </span>
    <input
      v-model.number="value"
      type="range"
      :min
      :max
      :step
      :disabled
      :aria-label="label"
      :aria-valuetext="shown"
      class="absolute inset-0 cursor-ew-resize opacity-0 disabled:cursor-not-allowed"
    />
  </div>
</template>
