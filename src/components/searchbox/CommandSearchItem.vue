<template>
  <div class="comfy-command-search-item">
    <span v-if="command.icon" class="item-icon" :class="command.icon" />
    <span v-else class="item-icon pi pi-chevron-right" />

    <span class="item-label">
      <span v-html="highlightedLabel" />
    </span>

    <span v-if="command.keybinding" class="item-keybinding">
      {{ command.keybinding.combo.toString() }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { ComfyCommandImpl } from '@/stores/commandStore'

const { command, currentQuery } = defineProps<{
  command: ComfyCommandImpl
  currentQuery: string
}>()

const highlightedLabel = computed(() => {
  const label = command.label || command.id
  if (!currentQuery) return label

  // Simple highlighting logic - case insensitive
  const regex = new RegExp(
    `(${currentQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi'
  )
  return label.replace(regex, '<mark>$1</mark>')
})
</script>

<style scoped>
.comfy-command-search-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  width: 100%;
}

.item-icon {
  flex-shrink: 0;
  width: 1.25rem;
  text-align: center;
  color: var(--p-text-muted-color);
}

.item-label {
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-label :deep(mark) {
  background-color: var(--p-highlight-background);
  color: var(--p-highlight-color);
  font-weight: 600;
  padding: 0;
}

.item-keybinding {
  flex-shrink: 0;
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.25rem;
  background: var(--p-content-hover-background);
  color: var(--p-text-muted-color);
  font-family: monospace;
}
</style>
