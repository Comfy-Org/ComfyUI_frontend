<script setup lang="ts" generic="T extends string">
import { ChevronDown } from '@lucide/vue'
import { useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const {
  label,
  options,
  bare = false,
  compact = false
} = defineProps<{
  label: string
  options: readonly { id: T; label: string; disabled?: boolean }[]
  /** Drops the field's own border and fill, to sit inside a pill. */
  bare?: boolean
  /** Keeps the label for screen readers only on phones. */
  compact?: boolean
}>()
const value = defineModel<T>({ required: true })
const id = useId()

function onChange(event: Event) {
  const { target } = event
  if (!(target instanceof HTMLSelectElement)) return
  const picked = options.find((option) => option.id === target.value)
  if (picked) value.value = picked.id
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-2 px-1">
    <label
      :for="id"
      :class="
        cn(
          'shrink-0 text-xs text-primary-warm-gray',
          compact && 'max-sm:sr-only'
        )
      "
      >{{ label }}</label
    >
    <div class="relative min-w-0 flex-1">
      <select
        :id
        :value
        :class="
          cn(
            'h-8 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg bg-primary-comfy-ink-light pr-7 pl-2.5 text-xs text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
            bare ? 'rounded-full pl-1' : 'bg-transparency-white-t4'
          )
        "
        @change="onChange"
      >
        <option
          v-for="option in options"
          :key="option.id"
          :value="option.id"
          :disabled="option.disabled"
          class="bg-primary-comfy-ink-light"
        >
          {{ option.label }}
        </option>
      </select>
      <ChevronDown
        class="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-primary-warm-gray"
        aria-hidden="true"
      />
    </div>
  </div>
</template>
