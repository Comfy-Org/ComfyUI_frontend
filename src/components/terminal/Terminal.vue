<template>
  <div class="relative h-full w-full bg-black" ref="root">
    <div class="p-terminal rounded-none h-full w-full p-2">
      <div
        class="h-full terminal-host"
        :class="{ ['h-[calc(100%-2rem)]']: allowInput, 'h-full': !allowInput }"
        ref="terminalEl"
      ></div>
      <TerminalInput
        v-if="allowInput"
        ref="terminalInput"
        class="h-8 w-full"
        @output="writeOutput"
        @execute="emit('execute', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import '@xterm/xterm/css/xterm.css'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { onMounted, onUnmounted, ref, toRefs } from 'vue'
import { debounce } from 'lodash'
import { TerminalSize } from '@/types/apiTypes'
import TerminalInput from './TerminalInput.vue'

const emit = defineEmits<{
  execute: [string]
}>()
const props = withDefaults(
  defineProps<{
    autoWidth?: boolean
    allowInput?: boolean
  }>(),
  {
    allowInput: false,
    autoWidth: false
  }
)
const { autoWidth, allowInput } = toRefs(props)
const root = ref<HTMLDivElement>()
const terminalEl = ref<HTMLDivElement>()
const terminalInput = ref<{ focus: () => void }>()
const fitAddon = new FitAddon()
const terminal = new Terminal({
  convertEol: true
})
terminal.loadAddon(fitAddon)

terminal.attachCustomKeyEventHandler((ev) => {
  if (!allowInput.value) {
    return
  }
  // If a simple key is pressed, or paste, focus the input box
  if (
    ev.type === 'keydown' &&
    ev.key.length === 1 &&
    ((!ev.ctrlKey && !ev.metaKey) || ev.key === 'v')
  ) {
    terminalInput.value?.focus()
  }
  return false
})

const ensureValidRows = (rows: number) => {
  if (isNaN(rows)) {
    // Sometimes this is NaN if so, estimate.
    return terminalEl.value?.clientHeight / 20
  }
  return rows
}

const resizeTerminal = () => {
  const dims = fitAddon.proposeDimensions()
  terminal.resize(
    autoWidth.value ? dims.cols : terminal.cols,
    ensureValidRows(dims.rows)
  )
}

const resizeObserver = new ResizeObserver(debounce(resizeTerminal, 50))

const update = (entries: Array<string>, size?: TerminalSize) => {
  if (size) {
    let rows = fitAddon.proposeDimensions().rows
    terminal.resize(size.cols, ensureValidRows(rows))
  }
  terminal.write(entries.map((e) => e).join(''))
}

const writeOutput = (message: string) => {
  update([`\x1b[1;32m${message}\n`])
}

onMounted(async () => {
  terminal.open(terminalEl.value)
  resizeObserver.observe(root.value)
})

onUnmounted(() => {
  resizeObserver.disconnect()
})

defineExpose({ update })
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
