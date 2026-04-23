<script setup lang="ts">
/**
 * InterruptCell — Stop button that appears in App Mode's top-right
 * cluster while jobs are active (gated on activeJobsCount > 0 by
 * AppChrome). Dispatches `Comfy.Interrupt` to cancel the current run.
 *
 * Forms the red half of the go/stop pair with RunCell's green
 * primary. Tomato-red fill + darker border gives it the bauhaus
 * primary-color feel; same size + text scale as RunCell so the pair
 * reads as siblings when both are on screen.
 */
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useCommandStore } from '@/stores/commandStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { toastErrorHandler } = useErrorHandling()

async function handleClick() {
  try {
    await commandStore.execute('Comfy.Interrupt')
  } catch (error) {
    toastErrorHandler(error)
  }
}
</script>

<template>
  <Button
    size="unset"
    :aria-label="t('linearMode.stop')"
    :title="t('linearMode.stop')"
    class="size-full rounded-lg border border-red-700 bg-red-500 text-white hover:bg-red-400"
    data-testid="layout-interrupt-cell"
    @click="handleClick"
  >
    <i class="icon-[lucide--x] size-(--text-layout-xl)" />
  </Button>
</template>
