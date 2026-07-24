<template>
  <div class="size-full bg-transparent">
    <p
      v-if="errorMessage"
      data-testid="terminal-error-message"
      class="p-4 text-center"
    >
      {{ errorMessage }}
    </p>
    <ProgressSpinner
      v-else-if="loading"
      data-testid="terminal-loading-spinner"
      class="relative inset-0 z-10 flex h-full items-center justify-center"
    />
    <BaseTerminal
      v-show="!loading && !errorMessage"
      @created="terminalCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { Terminal } from '@xterm/xterm'
import ProgressSpinner from 'primevue/progressspinner'
import type { Ref } from 'vue'
import { shallowRef } from 'vue'

import type { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'
import { useLogsTerminal } from '@/composables/bottomPanelTabs/useLogsTerminal'

import BaseTerminal from './BaseTerminal.vue'

const terminal = shallowRef<Terminal>()
const { errorMessage, loading } = useLogsTerminal(terminal)

const terminalCreated = (
  { terminal: instance, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement | undefined>
) => {
  // Auto-size terminal to fill container width.
  // minCols: 80 ensures minimum width for colab environments.
  // See https://github.com/comfyanonymous/ComfyUI/issues/6396
  useAutoSize({ root, autoRows: true, autoCols: true, minCols: 80 })
  terminal.value = instance
}
</script>

<style scoped>
:deep(.p-terminal) .xterm {
  overflow-x: auto;
}

:deep(.p-terminal) .xterm-screen {
  overflow-y: hidden;
}
</style>
