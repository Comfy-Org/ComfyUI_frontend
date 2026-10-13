<script setup lang="ts" generic="T extends string | number">
import { cn } from '@comfyorg/tailwind-utils'

const { options, disabled = false } = defineProps<{
  options: readonly {
    readonly value: T
    readonly label: string
    readonly title?: string
  }[]
  disabled?: boolean
  label: string
}>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    class="flex max-w-full overflow-hidden rounded-xl border border-transparency-white-t20 sm:inline-flex"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :disabled
      :title="option.title"
      :aria-pressed="model === option.value"
      :class="
        cn(
          'h-11 min-w-12 flex-1 cursor-pointer border-l border-transparency-white-t20 px-2 text-sm font-bold whitespace-nowrap first:border-l-0 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-4',
          model === option.value
            ? 'bg-primary-warm-white text-primary-comfy-ink'
            : 'bg-site-bg-soft text-content enabled:hover:bg-transparency-white-t8 enabled:hover:text-primary-warm-white'
        )
      "
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
