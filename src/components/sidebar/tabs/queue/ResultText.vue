<template>
  <div class="result-text-container" @click="copyToClipboard">
    <div class="text-content">
      {{ result }}
    </div>
    <div class="copy-button">
      <i class="pi pi-copy" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ResultItemImpl } from '@/stores/queueStore'

const props = defineProps<{
  result: ResultItemImpl
}>()

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.result.text)
  } catch (err) {
    console.error('Failed to copy text:', err)
  }
}
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
