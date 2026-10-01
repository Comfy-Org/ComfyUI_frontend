<script setup lang="ts">
import { useId } from 'vue'

const { label } = defineProps<{ label: string }>()
const value = defineModel<number>({ required: true })
const id = useId()
</script>

<template>
  <div class="flex items-center gap-3 px-1">
    <label :for="id" class="w-38 shrink-0 text-xs text-primary-warm-gray">{{
      label
    }}</label>
    <input
      :id
      v-model.number="value"
      type="range"
      min="0"
      max="100"
      class="h-1 min-w-0 flex-1 cursor-pointer accent-primary-comfy-yellow"
    />
    <span
      class="w-7 shrink-0 text-right font-mono text-[11px] text-primary-warm-white tabular-nums"
      >{{ value }}</span
    >
  </div>
</template>
