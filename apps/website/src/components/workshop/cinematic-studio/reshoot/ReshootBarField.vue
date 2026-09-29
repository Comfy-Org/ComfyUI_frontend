<script setup lang="ts">
import { computed, useId } from 'vue'

import InfoTooltip from '@/components/ui/tooltip/InfoTooltip.vue'

const {
  label,
  display,
  min,
  max,
  step,
  hint,
  disabled = false
} = defineProps<{
  label: string
  display: string
  min: number
  max: number
  step: number
  hint?: string
  disabled?: boolean
}>()

const value = defineModel<number>({ required: true })

const fill = computed(() => ((value.value - min) / (max - min)) * 100)

// The tooltip's text is portalled away from the bar, so the slider keeps its
// own copy to point `aria-describedby` at.
const hintId = useId()
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
      {{ display }}
    </span>
    <input
      v-model.number="value"
      type="range"
      :min
      :max
      :step
      :disabled
      :aria-label="label"
      :aria-valuetext="display"
      :aria-describedby="hint ? hintId : undefined"
      class="absolute inset-0 cursor-ew-resize opacity-0 disabled:cursor-not-allowed"
    />
    <span v-if="hint" :id="hintId" class="sr-only">{{ hint }}</span>
  </div>
</template>
