<script setup lang="ts">
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
  <Button
    size="unset"
    class="size-full rounded-lg border-0 bg-success-background text-layout-xl text-(--success-foreground) transition-[filter,transform] duration-100 ease-out hover:brightness-110 focus-visible:ring-2 focus-visible:ring-(--success-foreground) focus-visible:ring-offset-1 active:scale-[0.97]"
    data-testid="layout-run-cell"
    @click="handleClick"
  >
    <i class="icon-[lucide--play] size-(--text-layout-xl)" />
    {{ $t('menu.run') }}
  </Button>
</template>
