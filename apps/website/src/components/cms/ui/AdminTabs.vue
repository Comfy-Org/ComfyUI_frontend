<script setup lang="ts" generic="T extends string">
import { cn } from '@comfyorg/tailwind-utils'

/** The main views of a list, underlined like page tabs so they read above the filters. */
const { options, label } = defineProps<{
  options: ReadonlyArray<{ value: T; label: string }>
  label: string
}>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="-mb-px flex max-w-full gap-5 overflow-x-auto"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :class="
        cn(
          'shrink-0 cursor-pointer border-b-2 pt-1 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:text-admin-fg focus-visible:underline',
          model === option.value
            ? 'border-admin-fg text-admin-fg'
            : 'border-transparent text-admin-muted hover:text-admin-fg'
        )
      "
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
