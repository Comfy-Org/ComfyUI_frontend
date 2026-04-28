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
import Button from '@/components/ui/button/Button.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useCommandStore } from '@/stores/commandStore'

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
  <!-- active:scale gives press feedback (tactile on screen recordings);
       100ms is short enough not to delay command dispatch. -->
  <Button
    size="unset"
    class="size-full rounded-lg border border-(--app-mode-go-border) bg-(--app-mode-go-bg) text-layout-xl text-white transition-transform duration-100 ease-out hover:bg-(--app-mode-go-bg-hover) focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 active:scale-[0.97]"
    data-testid="layout-run-cell"
    @click="handleClick"
  >
    <i class="icon-[lucide--play] size-(--text-layout-xl)" />
    {{ $t('menu.run') }}
  </Button>
</template>
