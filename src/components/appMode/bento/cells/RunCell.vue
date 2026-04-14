<script setup lang="ts">
/**
 * RunCell — system-pinned cell that triggers workflow execution.
 *
 * Dispatches the same commands LinearControls does: Comfy.QueuePromptFront
 * with shift held (priority queue), Comfy.QueuePrompt otherwise.
 */
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()

async function handleClick(e: Event) {
  const priority = 'shiftKey' in e && (e as KeyboardEvent | MouseEvent).shiftKey
  const commandId = priority ? 'Comfy.QueuePromptFront' : 'Comfy.QueuePrompt'
  try {
    await commandStore.execute(commandId, {
      metadata: {
        subscribe_to_run: false,
        trigger_source: 'linear'
      }
    })
  } catch (error) {
    // Surface failures in the console so we can diagnose instead of
    // the button silently doing nothing.
    console.error('[RunCell] Queue prompt failed:', error)
  }
}
</script>

<template>
  <button
    type="button"
    class="run-cell"
    data-testid="bento-run-cell"
    @click="handleClick"
  >
    <i class="run-cell__icon icon-[lucide--play]" />
    {{ t('menu.run') }}
  </button>
</template>

<style scoped>
.run-cell {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: var(--bento-cell-radius);
  background-color: var(--bento-color-accent);
  color: var(--bento-color-accent-foreground);
  font-size: var(--bento-font-xl);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--bento-transition-duration)
    var(--bento-transition-easing);
}

.run-cell:hover {
  background-color: var(--bento-color-accent-hover);
}

.run-cell:active {
  background-color: var(--bento-color-accent-active);
}

.run-cell__icon {
  width: var(--bento-font-xl);
  height: var(--bento-font-xl);
}
</style>
