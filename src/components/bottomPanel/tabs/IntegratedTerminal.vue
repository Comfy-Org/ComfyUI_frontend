<template>
  <div class="relative h-full w-full">
    <ProgressSpinner
      v-if="!loaded"
      class="absolute inset-0 flex justify-center items-center h-full"
    />
    <div v-show="loaded" class="p-terminal rounded-none h-full w-full">
      <div class="h-full" ref="terminalEl"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import '@xterm/xterm/css/xterm.css'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { api, LogEntry, TerminalSize } from '@/scripts/api'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { debounce } from 'lodash'
import ProgressSpinner from 'primevue/progressspinner'

const loaded = ref(false)
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

const logReceived = (
  e: CustomEvent<{
    entries: Array<{ t: string; m: string }>
    size: {
      rows: number
      cols: number
    } | null
  }>
) => {
  update(e.detail.entries, e.detail.size)
}

const loadLogs = async () => {
  const logs = await api.getRawLogs()
  update(logs.entries, logs.size)
}

onMounted(async () => {
  terminal.open(terminalEl.value)
  await loadLogs()
  loaded.value = true
  await api.waitForClientId()
  api.subscribeLogs(true)
  api.addEventListener('logs', logReceived)
  resizeObserver.observe(terminalEl.value)

  // Wait for the component to render again and resize it
  await nextTick()
  resizeTerminal()
})

onUnmounted(() => {
  if (api.clientId) {
    api.subscribeLogs(false)
  }
  api.removeEventListener('logs', logReceived)
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
