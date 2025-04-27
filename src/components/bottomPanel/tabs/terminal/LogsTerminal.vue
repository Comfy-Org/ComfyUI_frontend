<template>
  <div class="bg-black h-full w-full">
    <p v-if="errorMessage" class="p-4 text-center">
      {{ errorMessage }}
    </p>
    <ProgressSpinner
      v-else-if="loading"
      class="relative inset-0 flex justify-center items-center h-full z-10"
    />
    <BaseTerminal v-show="!loading" @created="terminalCreated" />
  </div>
</template>

<script setup lang="ts">
import { until } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import ProgressSpinner from 'primevue/progressspinner'
import { Ref, onMounted, onUnmounted, ref } from 'vue'

import type { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'
import { LogEntry, LogsWsMessage, TerminalSize } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'

import BaseTerminal from './BaseTerminal.vue'

const errorMessage = ref('')
const loading = ref(true)

const terminalCreated = (
  { terminal, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement | undefined>
) => {
  // `autoCols` is false because we don't want the progress bar in the terminal
  // to render incorrectly as the progress bar is rendered based on the
  // server's terminal size.
  // Apply a min cols of 80 for colab environments
  // See https://github.com/comfyanonymous/ComfyUI/issues/6396
  useAutoSize({ root, autoRows: true, autoCols: false, minCols: 80 })

  const update = (entries: Array<LogEntry>, size?: TerminalSize) => {
    if (size) {
      terminal.resize(size.cols, terminal.rows)
    }
    terminal.write(entries.map((e) => e.m).join(''))
  }

  const logReceived = (e: CustomEvent<LogsWsMessage>) => {
    update(e.detail.entries, e.detail.size)
  }

  const loadLogEntries = async () => {
    const logs = await api.getRawLogs()
    update(logs.entries, logs.size)
  }

  const watchLogs = async () => {
    const { clientId } = storeToRefs(useExecutionStore())
    if (!clientId.value) {
      await until(clientId).not.toBeNull()
    }
    await api.subscribeLogs(true)
    api.addEventListener('logs', logReceived)
  }

  onMounted(async () => {
    try {
      await loadLogEntries()
    } catch (err) {
      console.error('Error loading logs', err)
      // On older backends the endpoints wont exist
      errorMessage.value =
        'Unable to load logs, please ensure you have updated your ComfyUI backend.'
      return
    }

    await watchLogs()
    loading.value = false
  })

  onUnmounted(async () => {
    if (api.clientId) {
      await api.subscribeLogs(false)
    }
    api.removeEventListener('logs', logReceived)
  })
}
</script>

<style scoped>
:deep(.p-terminal) .xterm {
  overflow-x: auto;
}

:deep(.p-terminal) .xterm-screen {
  background-color: black;
  overflow-y: hidden;
}
</style>
