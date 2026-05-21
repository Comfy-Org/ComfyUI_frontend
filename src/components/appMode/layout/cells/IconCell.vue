<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

defineProps<{
  /** Lucide / comfy icon class, e.g. 'icon-[lucide--hammer]' */
  icon: string
  /** Already-translated accessible label / tooltip text. */
  label: string
  inlineLabel?: boolean
  active?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ activate: [] }>()
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'duration-layout flex size-full items-center justify-center border-none bg-transparent p-0 text-layout-text transition-colors ease-layout',
        'cursor-pointer not-disabled:hover:bg-layout-cell-hover',
        'disabled:cursor-not-allowed disabled:opacity-40',
        { 'bg-layout-cell-hover': active }
      )
    "
    :aria-label="inlineLabel ? undefined : label"
    :title="label"
    :disabled="disabled"
    @click="emit('activate')"
  >
    <i :class="cn(icon, 'size-5')" />
    <span
      v-if="inlineLabel"
      class="ml-2 text-layout-md font-medium whitespace-nowrap"
    >
      {{ label }}
    </span>
  </button>
</template>
