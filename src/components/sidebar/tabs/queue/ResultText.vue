<template>
  <div class="result-text-container">
    <div class="text-content">
      {{ result.text }}
    </div>

    <Button
      class="copy-button"
      icon="pi pi-copy"
      text
      @click.stop="copyToClipboard(result.text ?? '')"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { ResultItemImpl } from '@/stores/queueStore'

defineProps<{
  result: ResultItemImpl
}>()

const { copyToClipboard } = useCopyToClipboard()
</script>

<style scoped>
.result-text-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  cursor: pointer;
  padding: 1rem;
  text-align: center;
  word-break: break-word;
}

.text-content {
  font-size: 0.875rem;
  color: var(--text-color);
  width: 100%;
  max-height: 100%;
  max-width: 80vw;
  overflow-y: auto;
  line-height: 1.5;
  padding-right: 0.5rem;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

/* Hide scrollbar but keep functionality */
.text-content::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

.copy-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease;
  color: var(--text-color-secondary);
  padding: 0.25rem;
  border-radius: 0.25rem;
  background-color: var(--surface-ground);
}

.result-text-container:hover .copy-button {
  opacity: 1;
}

.copy-button:hover {
  background-color: var(--surface-hover);
}
</style>
