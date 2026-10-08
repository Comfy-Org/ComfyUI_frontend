<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

type ChipOption = {
  id: string
  label: string
  selected?: boolean
  mono?: boolean
}
const { label, options, showOptionDetails, moreOptionsLabel } = defineProps<{
  label: string
  options: readonly ChipOption[]
  showOptionDetails: boolean
  moreOptionsLabel: string
}>()
const selectedIds = defineModel<string[]>({ required: true })
function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((existing) => existing !== id)
    : [...ids, id]
}
const chipClasses = (option: ChipOption, selected: boolean) =>
  cn(
    'flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 transition-colors',
    option.mono ? 'font-mono text-[11.5px]' : 'text-[13px]',
    selected
      ? 'bg-primary-comfy-plum text-primary-warm-white'
      : 'bg-primary-comfy-canvas/8 text-primary-comfy-canvas hover:bg-primary-comfy-canvas/15'
  )
const selectionIndicatorClasses = (selected: boolean) =>
  selected ? 'bg-primary-comfy-yellow' : 'border border-primary-warm-gray'
</script>

<template>
  <div class="mt-6" role="group" :aria-label="label">
    <p
      class="text-[0.65rem] tracking-[0.12em] text-primary-warm-white/55 uppercase"
    >
      {{ label }}
    </p>
    <div class="mt-3 flex flex-wrap gap-2">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        :aria-pressed="selectedIds.includes(option.id)"
        :class="chipClasses(option, selectedIds.includes(option.id))"
        @click="selectedIds = toggleId(selectedIds, option.id)"
      >
        <span
          v-if="showOptionDetails"
          class="size-1.5 shrink-0 rounded-full"
          :class="selectionIndicatorClasses(selectedIds.includes(option.id))"
        />
        {{ option.label }}
      </button>
      <span
        v-if="showOptionDetails"
        class="self-center text-[13px] text-primary-warm-white/55 underline underline-offset-4"
      >
        {{ moreOptionsLabel }}
      </span>
    </div>
  </div>
</template>
