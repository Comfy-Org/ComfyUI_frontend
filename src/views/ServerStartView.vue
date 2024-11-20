<template>
  <div
    class="font-sans flex flex-col justify-center items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <h2 class="text-2xl font-bold">{{ ProgressMessages[status] }}</h2>
    <BaseTerminal @created="terminalCreated" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, Ref } from 'vue'
import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'
import {
  ProgressStatus,
  ProgressMessages
} from '@comfyorg/comfyui-electron-types'
import { electronAPI } from '@/utils/envUtil'
import type { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'
import { Terminal } from '@xterm/xterm'

const electron = electronAPI()

const status = ref<ProgressStatus>(ProgressStatus.INITIAL_STATE)
let xterm: Terminal | undefined

const updateProgress = ({ status: newStatus }: { status: ProgressStatus }) => {
  status.value = newStatus
  xterm?.clear()
}

const terminalCreated = (
  { terminal, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement>
) => {
  xterm = terminal

  useAutoSize(root, true, true)
  electron.onLogMessage((message: string) => {
    terminal.write(message)
  })

  terminal.options.cursorBlink = false
  terminal.options.disableStdin = true
  terminal.options.cursorInactiveStyle = 'block'
}

onMounted(() => {
  electron.sendReady()
  electron.onProgressUpdate(updateProgress)
})
</script>

<style scoped>
:deep(.xterm-helper-textarea) {
  /* Hide this as it moves all over when uv is running */
  display: none;
}
</style>
