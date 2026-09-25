<script setup lang="ts">
import { computed } from 'vue'

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
</script>

<template>
  <div class="flex flex-col gap-1">
    <label
      class="relative flex h-11 items-center justify-between overflow-hidden rounded-xl px-3.5 text-[13px] ring-1 ring-transparency-white-t8 ring-inset focus-within:ring-primary-comfy-yellow/60 has-disabled:opacity-40"
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
      <span class="relative text-primary-comfy-canvas">{{ label }}</span>
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
        class="absolute inset-0 cursor-ew-resize opacity-0 disabled:cursor-not-allowed"
      />
    </label>
    <p v-if="hint" class="px-1 text-[11px] text-primary-warm-gray">
      {{ hint }}
    </p>
  </div>
</template>
