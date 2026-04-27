<script setup lang="ts">
/**
 * RunCell — system-pinned cell that triggers workflow execution.
 *
 * Dispatches the same commands LinearControls does: Comfy.QueuePromptFront
 * with shift held (priority queue), Comfy.QueuePrompt otherwise.
 *
 * Styled as the "Go" half of the go/stop pair (the Stop button now
 * lives inside OutputWindow's body-overlay): saturated green fill +
 * darker border for depth. Together they give the run UX a bauhaus-
 * primary semantic language (green = go, red = stop) that reads
 * instantly without the user parsing the text.
 */
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { toastErrorHandler } = useErrorHandling()

async function handleClick(e: MouseEvent | KeyboardEvent) {
  const commandId = e.shiftKey ? 'Comfy.QueuePromptFront' : 'Comfy.QueuePrompt'
  try {
    await commandStore.execute(commandId, {
      metadata: { subscribe_to_run: false, trigger_source: 'linear' }
    })
  } catch (error) {
    toastErrorHandler(error)
  }
}
</script>

<template>
  <Button
    size="unset"
    :class="[
      'size-full rounded-lg text-layout-xl text-white',
      'border border-(--app-mode-go-border) bg-(--app-mode-go-bg)',
      'hover:bg-(--app-mode-go-bg-hover)',
      'focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1',
      // Press feedback: a small scale-down on active so clicks feel
      // tactile on camera. 100ms keeps it punchy — fast enough not to
      // delay the command dispatch, long enough to be visible.
      'transition-transform duration-100 ease-out active:scale-[0.97]'
    ]"
    data-testid="layout-run-cell"
    @click="handleClick"
  >
    <i class="icon-[lucide--play] size-(--text-layout-xl)" />
    {{ t('menu.run') }}
  </Button>
</template>
