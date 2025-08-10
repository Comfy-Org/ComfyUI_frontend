<template>
  <div class="flex items-center gap-3 px-3 py-2 w-full">
    <span
      v-if="command.icon"
      class="flex-shrink-0 w-5 text-center text-muted"
      :class="command.icon"
    />
    <span
      v-else
      class="flex-shrink-0 w-5 text-center text-muted pi pi-chevron-right"
    />

    <span class="flex-grow overflow-hidden text-ellipsis whitespace-nowrap">
      <span
        v-html="highlightQuery(command.getTranslatedLabel(), currentQuery)"
      />
    </span>

    <span
      v-if="command.keybinding"
      class="flex-shrink-0 text-xs px-1.5 py-0.5 border rounded font-mono keybinding-badge"
    >
      {{ command.keybinding.combo.toString() }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { ComfyCommandImpl } from '@/stores/commandStore'
import { highlightQuery } from '@/utils/formatUtil'

const { command, currentQuery } = defineProps<{
  command: ComfyCommandImpl
  currentQuery: string
}>()
</script>

<style scoped>
:deep(.highlight) {
  background-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-weight: bold;
  border-radius: 0.25rem;
  padding: 0 0.125rem;
  margin: -0.125rem 0.125rem;
}

.keybinding-badge {
  border-color: var(--p-content-border-color);
  background-color: var(--p-content-hover-background);
  color: var(--p-text-muted-color);
}
</style>
