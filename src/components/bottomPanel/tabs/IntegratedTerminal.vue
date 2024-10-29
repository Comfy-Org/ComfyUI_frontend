<template>
  <div class="relative h-full w-full bg-black">
    <ProgressSpinner
      v-if="loading"
      class="absolute inset-0 flex justify-center items-center h-full z-10"
    />
    <div class="p-terminal rounded-none h-full w-full p-2">
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

let intervalId: number
let useFallbackPolling: boolean = false
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

const loadLogText = async () => {
  // Fallback to using string logs
  const logs = await api.getLogs()
  terminal.clear()
  terminal.write(logs)
  fitAddon.fit()
}

const loadLogEntries = async () => {
  const logs = await api.getRawLogs()
  update(logs.entries, logs.size)
}

const watchLogs = async () => {
  if (useFallbackPolling) {
    intervalId = window.setInterval(loadLogText, 500)
  } else {
    const { clientId } = storeToRefs(useExecutionStore())
    if (!clientId.value) {
      console.log('waiting')
      await until(clientId).not.toBeNull()
      console.log('waited', clientId.value)
    }
    api.subscribeLogs(true)
    api.addEventListener('logs', logReceived)
  }
}

onMounted(async () => {
  terminal.open(terminalEl.value)

  try {
    await loadLogEntries()
  } catch {
    // On older backends the endpoints wont exist, fallback to poll
    useFallbackPolling = true
    await loadLogText()
  }

  loading.value = false
  resizeObserver.observe(terminalEl.value)

  await watchLogs()
})

onUnmounted(() => {
  if (useFallbackPolling) {
    window.clearInterval(intervalId)
  } else {
    if (api.clientId) {
      api.subscribeLogs(false)
    }
    api.removeEventListener('logs', logReceived)
  }

  resizeObserver.disconnect()
})
</script>

<style>
.p-terminal .xterm {
  overflow-x: auto;
}

.p-terminal .xterm-screen {
  background-color: black;
  overflow-y: hidden;
}
</style>
