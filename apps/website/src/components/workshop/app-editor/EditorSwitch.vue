<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { label, disabled = false } = defineProps<{
  label: string
  disabled?: boolean
}>()
const on = defineModel<boolean>({ required: true })
</script>

<template>
  <div class="flex h-8 items-center justify-between gap-3 px-1">
    <span class="text-xs text-primary-warm-gray">{{ label }}</span>
    <button
      type="button"
      role="switch"
      :aria-checked="on"
      :aria-label="label"
      :disabled
      :class="
        cn(
          'flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40',
          on
            ? 'justify-end bg-primary-comfy-yellow'
            : 'justify-start bg-transparency-white-t20'
        )
      "
      @click="on = !on"
    >
      <span class="size-4 rounded-full bg-primary-comfy-ink" />
    </button>
  </div>
</template>
