<template>
  <div class="relative h-full w-full bg-black">
    <p v-if="errorMessage" class="p-4 text-center">{{ errorMessage }}</p>
    <ProgressSpinner
      v-else-if="loading"
      class="absolute inset-0 flex justify-center items-center h-full z-10"
    />
    <div v-show="!loading" class="p-terminal rounded-none h-full w-full p-2">
      <div class="h-full" ref="terminalEl"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@xterm/xterm/css/xterm.css'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { api } from '@/scripts/api'
import { onMounted, onUnmounted, ref } from 'vue'
import { debounce } from 'lodash'
import ProgressSpinner from 'primevue/progressspinner'
import { useExecutionStore } from '@/stores/executionStore'
import { storeToRefs } from 'pinia'
import { until } from '@vueuse/core'
import { LogEntry, LogsWsMessage, TerminalSize } from '@/types/apiTypes'

const errorMessage = ref('')
const loading = ref(true)
const terminalEl = ref<HTMLDivElement>()
const fitAddon = new FitAddon()
const terminal = new Terminal({
  convertEol: true
})
terminal.loadAddon(fitAddon)

const resizeTerminal = () =>
  terminal.resize(terminal.cols, fitAddon.proposeDimensions().rows)

const resizeObserver = new ResizeObserver(debounce(resizeTerminal, 50))

const update = (entries: Array<LogEntry>, size?: TerminalSize) => {
  if (size) {
    terminal.resize(size.cols, fitAddon.proposeDimensions().rows)
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
  terminal.open(terminalEl.value)

  try {
    await loadLogEntries()
  } catch (err) {
    console.error('Error loading logs', err)
    // On older backends the endpoints wont exist
    errorMessage.value =
      'Unable to load logs, please ensure you have updated your ComfyUI backend.'
    return
  }

  loading.value = false
  resizeObserver.observe(terminalEl.value)

  await watchLogs()
})

onUnmounted(() => {
  if (api.clientId) {
    api.subscribeLogs(false)
  }
  api.removeEventListener('logs', logReceived)

  resizeObserver.disconnect()
})
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
