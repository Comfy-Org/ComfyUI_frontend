<script setup lang="ts">
/**
 * IconCell — generic icon-button layout cell.
 *
 * Used for system-pinned utility cells: Builder (hammer), Share (send),
 * Assets (image-ai-edit), Apps (panels-top-left), Help (question).
 */
defineProps<{
  /** Lucide / comfy icon class, e.g. 'icon-[lucide--hammer]' */
  icon: string
  /** Accessible label and tooltip text (already-translated string) */
  label: string
  /** Render the label inline next to the icon (for multi-col cells). */
  inlineLabel?: boolean
  /** Whether the cell shows an active/selected visual state */
  active?: boolean
  /** Whether the cell is disabled */
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
