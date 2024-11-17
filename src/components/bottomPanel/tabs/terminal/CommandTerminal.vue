<template>
  <BaseTerminal @created="terminalCreated" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, Ref } from 'vue'
import type { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'
import { electronAPI } from '@/utils/envUtil'
import { IDisposable } from '@xterm/xterm'
import BaseTerminal from './BaseTerminal.vue'

const terminalCreated = (
  { terminal, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement>
) => {
  // TODO: use types from electron package
  const terminalApi = electronAPI()['Terminal'] as {
    onOutput(cb: (message: string) => void): () => void
    resize(cols: number, rows: number): void
    restore(): Promise<{
      buffer: string[]
      pos: { x: number; y: number }
      size: { cols: number; rows: number }
    }>
    storePos(x: number, y: number): void
    write(data: string): void
  }

  let offData: IDisposable
  let offOutput: () => void

  useAutoSize(root, true, true, () => {
    // If we aren't visible, don't resize
    if (!terminal.element?.offsetParent) return

    terminalApi.resize(terminal.cols, terminal.rows)
  })

  onMounted(async () => {
    offData = terminal.onData(async (message: string) => {
      terminalApi.write(message)
    })

    offOutput = terminalApi.onOutput((message) => {
      terminal.write(message)
    })

    const restore = await terminalApi.restore()
    setTimeout(() => {
      if (restore.buffer.length) {
        terminal.resize(restore.size.cols, restore.size.rows)
        terminal.write(restore.buffer.join(''))
      }
    }, 500)
  })

  onUnmounted(() => {
    offData?.dispose()
    offOutput?.()
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
