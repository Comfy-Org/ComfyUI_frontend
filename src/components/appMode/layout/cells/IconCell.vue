<script setup lang="ts">
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
    :class="[
      'duration-layout flex size-full items-center justify-center border-none bg-transparent p-0 text-layout-text transition-colors ease-layout',
      'cursor-pointer not-disabled:hover:bg-layout-cell-hover',
      'disabled:cursor-not-allowed disabled:opacity-40',
      { 'bg-layout-cell-hover': active }
    ]"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    @click="emit('activate')"
  >
    <i :class="[icon, 'size-5']" />
    <span
      v-if="inlineLabel"
      class="ml-2 text-layout-md font-medium whitespace-nowrap"
    >
      {{ label }}
    </span>
  </button>
</template>
