<script setup lang="ts">
import { useId } from 'vue'

const {
  label,
  min = 0,
  max = 100,
  unit = ''
} = defineProps<{
  label: string
  min?: number
  max?: number
  unit?: string
}>()
const value = defineModel<number>({ required: true })
const id = useId()
</script>

<template>
  <div class="flex flex-col gap-1.5 px-1">
    <div class="flex items-center justify-between gap-3">
      <label :for="id" class="text-xs text-primary-warm-gray">{{
        label
      }}</label>
      <span
        class="min-w-10 rounded-md bg-transparency-white-t4 px-1.5 py-0.5 text-right font-mono text-[11px] text-primary-warm-white tabular-nums"
        >{{ value }}{{ unit }}</span
      >
    </div>
    <input
      :id
      v-model.number="value"
      type="range"
      :min
      :max
      class="h-1 w-full cursor-pointer accent-primary-comfy-yellow"
    />
  </div>
</template>
