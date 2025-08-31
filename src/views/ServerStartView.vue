<template>
  <BaseViewTemplate dark>
    <ServerProgress
      :status="status"
      :electron-version="electronVersion"
      :terminal-visible="terminalVisible"
      @report-issue="reportIssue"
      @open-logs="openLogs"
      @troubleshoot="troubleshoot"
      @toggle-terminal="terminalVisible = $event"
    >
      <template #terminal>
        <BaseTerminal @created="terminalCreated" />
      </template>
    </ServerProgress>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { ProgressStatus } from '@comfyorg/comfyui-electron-types'
import type { Terminal } from '@xterm/xterm'
import type { Ref } from 'vue'
import { onMounted, onUnmounted, ref } from 'vue'

import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'
import ServerProgress from '@/components/server/ServerProgress.vue'
import type { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'
import { electronAPI } from '@/utils/envUtil'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const electron = electronAPI()

const status = ref<ProgressStatus>(ProgressStatus.INITIAL_STATE)
const electronVersion = ref<string>('')
let xterm: Terminal | undefined

const terminalVisible = ref(false)

const updateProgress = ({ status: newStatus }: { status: ProgressStatus }) => {
  status.value = newStatus

  // Make critical error screen more obvious.
  if (newStatus === ProgressStatus.ERROR) terminalVisible.value = false
}

const terminalCreated = (
  { terminal, useAutoSize }: ReturnType<typeof useTerminal>,
  root: Ref<HTMLElement | undefined>
) => {
  xterm = terminal

  useAutoSize({ root, autoRows: true, autoCols: true })
  electron.onLogMessage((message: string) => {
    terminal.write(message)
  })

  terminal.options.cursorBlink = false
  terminal.options.disableStdin = true
  terminal.options.cursorInactiveStyle = 'block'
}

const troubleshoot = () => electron.startTroubleshooting()
const reportIssue = () => {
  window.open('https://forum.comfy.org/c/v1-feedback/', '_blank')
}
const openLogs = () => electron.openLogsFolder()

onMounted(async () => {
  electron.sendReady()
  electron.onProgressUpdate(updateProgress)
  electronVersion.value = await electron.getElectronVersion()
})

onUnmounted(() => {
  xterm?.dispose()
})
</script>
