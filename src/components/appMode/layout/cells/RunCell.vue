<script setup lang="ts">
/**
 * RunCell — system-pinned cell that triggers workflow execution.
 *
 * Dispatches the same commands LinearControls does: Comfy.QueuePromptFront
 * with shift held (priority queue), Comfy.QueuePrompt otherwise.
 *
 * Visual treatment comes from the shared Button primitive's `primary`
 * variant — App Mode no longer owns a bespoke accent color. If the
 * "Run = green" convention lands app-wide, it'll flip here for free.
 */
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { toastErrorHandler } = useErrorHandling()

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
    toastErrorHandler(error)
  }
}
</script>

<template>
  <Button
    variant="primary"
    size="unset"
    class="size-full rounded-lg border border-cobalt-800 text-layout-xl"
    data-testid="layout-run-cell"
    @click="handleClick"
  >
    <i class="icon-[lucide--play] size-(--text-layout-xl)" />
    {{ t('menu.run') }}
  </Button>
</template>
