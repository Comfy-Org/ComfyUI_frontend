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
  /** Click handler */
  onActivate?: () => void | Promise<void>
}>()
</script>

<template>
  <button
    type="button"
    class="icon-cell"
    :class="{ 'icon-cell--active': active }"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    @click="() => onActivate?.()"
  >
    <i :class="[icon, 'icon-cell__icon']" />
    <span v-if="inlineLabel" class="icon-cell__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.icon-cell {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--layout-color-text);
  cursor: pointer;
  transition: background-color var(--layout-transition-duration)
    var(--layout-transition-easing);
}

.icon-cell:hover:not(:disabled) {
  background-color: var(--layout-color-cell-hover);
}

.icon-cell:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.icon-cell--active {
  background-color: var(--layout-color-cell-hover);
}

.icon-cell__icon {
  width: 20px;
  height: 20px;
}

.icon-cell__label {
  margin-left: 8px;
  font-size: var(--layout-font-md);
  font-weight: 500;
  white-space: nowrap;
}
</style>
