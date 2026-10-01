<script setup lang="ts" generic="T extends string">
import { cn } from '@comfyorg/tailwind-utils'

const { label, options } = defineProps<{
  label: string
  options: readonly { id: T; label: string }[]
}>()
const value = defineModel<T>({ required: true })
</script>

<template>
  <div class="flex items-center justify-between gap-3 px-1">
    <span class="text-xs text-primary-warm-gray">{{ label }}</span>
    <div
      role="radiogroup"
      :aria-label="label"
      class="flex rounded-full bg-transparency-white-t4 p-0.5"
    >
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="value === option.id"
        :class="
          cn(
            'h-6 rounded-full px-3 text-[11px] text-primary-warm-gray transition focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
            value === option.id &&
              'bg-transparency-white-t20 text-primary-warm-white'
          )
        "
        @click="value = option.id"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
