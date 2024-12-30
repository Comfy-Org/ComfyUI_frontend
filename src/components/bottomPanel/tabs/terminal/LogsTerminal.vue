<template>
  <div class="bg-black h-full w-full">
    <p v-if="errorMessage" class="p-4 text-center">{{ errorMessage }}</p>
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

import type { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { LogEntry, LogsWsMessage, TerminalSize } from '@/types/apiTypes'

import BaseTerminal from './BaseTerminal.vue'

const errorMessage = ref('')
const loading = ref(true)

const terminalCreated = (
  { terminal, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement>
) => {
  useAutoSize(root, true, false)

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
    api.subscribeLogs(true)
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

  onUnmounted(() => {
    if (api.clientId) {
      api.subscribeLogs(false)
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
