<template>
  <div
    class="font-sans flex flex-col justify-center items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <h2 class="text-2xl font-bold">
      {{ t(`serverStart.process.${status}`) }}
      <span v-if="status === ProgressStatus.ERROR">
        v{{ electronVersion }}
      </span>
    </h2>
    <div
      v-if="status === ProgressStatus.ERROR"
      class="flex items-center my-4 gap-2"
    >
      <Button
        icon="pi pi-flag"
        severity="secondary"
        :label="t('serverStart.reportIssue')"
        @click="reportIssue"
      />
      <Button
        icon="pi pi-file"
        severity="secondary"
        :label="t('serverStart.openLogs')"
        @click="openLogs"
      />
      <Button
        icon="pi pi-refresh"
        :label="t('serverStart.reinstall')"
        @click="reinstall"
      />
    </div>
    <BaseTerminal @created="terminalCreated" />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref, onMounted, Ref } from 'vue'
import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'
import { ProgressStatus } from '@comfyorg/comfyui-electron-types'
import { electronAPI } from '@/utils/envUtil'
import type { useTerminal } from '@/hooks/bottomPanelTabs/useTerminal'
import { Terminal } from '@xterm/xterm'
import { useI18n } from 'vue-i18n'

const electron = electronAPI()
const { t } = useI18n()

const status = ref<ProgressStatus>(ProgressStatus.INITIAL_STATE)
const electronVersion = ref<string>('')
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

const reinstall = () => electron.reinstall()
const reportIssue = () => {
  window.open('https://forum.comfy.org/c/v1-feedback/', '_blank')
}
const openLogs = () => electron.openLogsFolder()

onMounted(async () => {
  electron.sendReady()
  electron.onProgressUpdate(updateProgress)
  electronVersion.value = await electron.getElectronVersion()
})
</script>

<style scoped>
:deep(.xterm-helper-textarea) {
  /* Hide this as it moves all over when uv is running */
  display: none;
}
</style>
