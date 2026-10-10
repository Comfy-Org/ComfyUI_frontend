<script setup lang="ts" generic="T extends string">
import { cn } from '@comfyorg/tailwind-utils'

/** A small set of mutually exclusive choices, as the list filters show them. */
const {
  options,
  label,
  size = 'md'
} = defineProps<{
  options: ReadonlyArray<{ value: T; label: string }>
  label: string
  size?: 'sm' | 'md'
}>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-admin-field p-0.5"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :class="
        cn(
          'inline-flex shrink-0 cursor-pointer items-center rounded-md font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-admin-fg',
          size === 'sm' ? 'h-6 px-2 text-xs' : 'h-6.5 px-2.5 text-xs',
          model === option.value
            ? 'bg-admin-selected text-admin-fg'
            : 'text-admin-muted hover:text-admin-fg'
        )
      "
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
