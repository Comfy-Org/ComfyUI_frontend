<script setup lang="ts">
import { useId } from 'vue'

const { label } = defineProps<{ label: string }>()
const value = defineModel<number>({ required: true })
const id = useId()

function onChange(event: Event) {
  const next =
    event.target instanceof HTMLInputElement
      ? Math.round(Number(event.target.value))
      : NaN
  if (Number.isFinite(next) && next >= 0) value.value = next
}
</script>

<template>
  <div class="flex h-8 items-center gap-2 px-1">
    <label :for="id" class="w-40 shrink-0 text-xs text-primary-warm-gray">{{
      label
    }}</label>
    <input
      :id
      :value
      type="number"
      min="0"
      step="1"
      class="h-8 min-w-0 flex-1 rounded-lg bg-transparency-white-t4 px-2.5 text-xs text-primary-warm-white tabular-nums focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40"
      @change="onChange"
    />
  </div>
</template>
