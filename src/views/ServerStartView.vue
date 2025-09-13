<template>
  <BaseViewTemplate dark class="flex-col">
    <div class="flex flex-col w-full h-full items-center">
      <h2 class="text-2xl font-bold">
        {{ t(`serverStart.process.${status}`) }}
        <span v-if="status === ProgressStatus.ERROR">
          v{{ electronVersion }}
        </span>
      </h2>
      <div
        v-if="status === ProgressStatus.ERROR"
        class="flex flex-col items-center gap-4"
      >
        <div class="flex items-center my-4 gap-2">
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
            icon="pi pi-wrench"
            :label="t('serverStart.troubleshoot')"
            @click="troubleshoot"
          />
        </div>
        <Button
          v-if="!terminalVisible"
          icon="pi pi-search"
          severity="secondary"
          :label="t('serverStart.showTerminal')"
          @click="terminalVisible = true"
        />
      </div>
      <BaseTerminal v-show="terminalVisible" @created="terminalCreated" />
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { ProgressStatus } from '@comfyorg/comfyui-electron-types'
import { Terminal } from '@xterm/xterm'
import Button from 'primevue/button'
import { Ref, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'
import type { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'
import { electronAPI } from '@/utils/envUtil'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const electron = electronAPI()
const { t } = useI18n()

const status = ref<ProgressStatus>(ProgressStatus.INITIAL_STATE)
const electronVersion = ref<string>('')
let xterm: Terminal | undefined

const terminalVisible = ref(true)

const updateProgress = ({ status: newStatus }: { status: ProgressStatus }) => {
  status.value = newStatus

  // Make critical error screen more obvious.
  if (newStatus === ProgressStatus.ERROR) terminalVisible.value = false
  else xterm?.clear()
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
</script>

<style scoped>
:deep(.xterm-helper-textarea) {
  /* Hide this as it moves all over when uv is running */
  display: none;
}
</style>
