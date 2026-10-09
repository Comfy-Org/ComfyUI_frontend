<script setup lang="ts">
import { useId } from 'vue'

const { label } = defineProps<{ label: string }>()
const value = defineModel<number>({ required: true })
const id = useId()

function wholeNumber(raw: string) {
  const next = Math.round(Number(raw))
  return raw.trim() !== '' && Number.isFinite(next) && next >= 0
    ? next
    : undefined
}

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const next = wholeNumber(event.target.value)
  if (next === undefined) event.target.value = String(value.value)
  else value.value = next
}
</script>

<template>
  <div class="flex h-8 items-center gap-2 px-1">
    <label
      :for="id"
      data-field-label
      class="w-24 shrink-0 text-xs text-primary-warm-gray"
      >{{ label }}</label
    >
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
