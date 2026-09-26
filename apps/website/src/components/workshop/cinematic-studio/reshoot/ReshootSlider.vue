<script setup lang="ts">
const {
  label,
  display,
  min,
  max,
  step,
  disabled = false
} = defineProps<{
  label: string
  display: string
  min: number
  max: number
  step: number
  disabled?: boolean
}>()

const value = defineModel<number>({ required: true })
</script>

<template>
  <label class="flex flex-col gap-1.5">
    <span class="flex items-center justify-between text-xs">
      <span class="text-primary-comfy-canvas">{{ label }}</span>
      <span class="font-mono text-primary-warm-white tabular-nums">
        {{ display }}
      </span>
    </span>
    <input
      v-model.number="value"
      type="range"
      :min
      :max
      :step
      :disabled
      class="w-full accent-primary-comfy-yellow disabled:opacity-40"
    />
  </label>
</template>
