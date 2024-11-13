<template>
  <BaseTerminal @created="terminalCreated" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, defineEmits, Ref } from 'vue'
import type { useTerminal } from './useTerminal'
import { LogEntry, LogsWsMessage, TerminalSize } from '@/types/apiTypes'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { until } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import BaseTerminal from './BaseTerminal.vue'

const emit = defineEmits<{
  error: [string]
  ready: []
}>()

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
      emit(
        'error',
        'Unable to load logs, please ensure you have updated your ComfyUI backend.'
      )
      return
    }

    emit('ready')
    await watchLogs()
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
