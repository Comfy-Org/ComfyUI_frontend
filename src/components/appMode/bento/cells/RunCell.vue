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
  border-radius: 4px;
  /* GitHub Primer success-button green */
  background-color: #2da44e;
  color: #ffffff;
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms cubic-bezier(0.32, 0.72, 0, 1);
}

.run-cell:hover {
  background-color: #2c974b;
}

.run-cell:active {
  background-color: #298e46;
}

.run-cell__icon {
  width: 18px;
  height: 18px;
}
</style>
