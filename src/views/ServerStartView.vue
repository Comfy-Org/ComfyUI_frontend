<template>
  <BaseViewTemplate dark>
    <div class="relative min-h-screen">
      <!-- Terminal Background Layer (always visible during loading) -->
      <div v-if="!isError" class="fixed inset-0 overflow-hidden z-0">
        <div class="h-full w-full">
          <BaseTerminal @created="terminalCreated" />
        </div>
      </div>

      <!-- Semi-transparent overlay -->
      <div v-if="!isError" class="fixed inset-0 bg-neutral-900/80 z-5"></div>

      <!-- Smooth radial gradient overlay -->
      <div
        v-if="!isError"
        class="fixed inset-0 z-8"
        style="
          background: radial-gradient(
            ellipse 800px 600px at center,
            rgba(23, 23, 23, 0.95) 0%,
            rgba(23, 23, 23, 0.93) 10%,
            rgba(23, 23, 23, 0.9) 20%,
            rgba(23, 23, 23, 0.85) 30%,
            rgba(23, 23, 23, 0.75) 40%,
            rgba(23, 23, 23, 0.6) 50%,
            rgba(23, 23, 23, 0.4) 60%,
            rgba(23, 23, 23, 0.2) 70%,
            rgba(23, 23, 23, 0.1) 80%,
            rgba(23, 23, 23, 0.05) 90%,
            transparent 100%
          );
        "
      ></div>

      <div class="relative z-10">
        <!-- Main startup display using StartupDisplay component -->
        <StartupDisplay
          :title="displayTitle"
          :status-text="displayStatusText"
          :progress-percentage="installProgress"
          :hide-progress="isError"
        />

        <!-- Error Section (positioned at bottom) -->
        <div
          v-if="isError"
          class="absolute bottom-20 left-0 right-0 flex flex-col items-center gap-4"
        >
          <div class="flex gap-4 justify-center">
            <Button
              icon="pi pi-flag"
              :label="$t('serverStart.reportIssue')"
              severity="secondary"
              @click="reportIssue"
            />
            <Button
              icon="pi pi-file"
              :label="$t('serverStart.openLogs')"
              severity="secondary"
              @click="openLogs"
            />
            <Button
              icon="pi pi-wrench"
              :label="$t('serverStart.troubleshoot')"
              @click="troubleshoot"
            />
          </div>

          <div class="text-center">
            <button
              v-if="!terminalVisible"
              class="text-sm text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-2 mx-auto"
              @click="terminalVisible = true"
            >
              <i class="pi pi-search"></i>
              {{ $t('serverStart.showTerminal') }}
            </button>
          </div>
        </div>

        <!-- Terminal Output (positioned at bottom when manually toggled in error state) -->
        <div
          v-if="terminalVisible && isError"
          class="absolute bottom-4 left-4 right-4 max-w-4xl mx-auto z-10"
        >
          <div
            class="bg-neutral-900/95 rounded-lg p-4 border border-neutral-700"
            style="height: 300px"
          >
            <BaseTerminal @created="terminalCreated" />
          </div>
        </div>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import {
  InstallStage,
  type InstallStageInfo,
  type InstallStageType,
  ProgressStatus
} from '@comfyorg/comfyui-electron-types'
import type { Terminal } from '@xterm/xterm'
import Button from 'primevue/button'
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'
import StartupDisplay from '@/components/common/StartupDisplay.vue'
import type { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'
import { STAGE_METADATA } from '@/types/installStageTypes'
import { electronAPI } from '@/utils/envUtil'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const { t } = useI18n()
const electron = electronAPI()

const status = ref<ProgressStatus>(ProgressStatus.INITIAL_STATE)
const electronVersion = ref<string>('')
const terminalVisible = ref(false)

const installStage = ref<InstallStageType | null>(null)
const installStageMessage = ref<string>('')
const installStageProgress = ref<number | undefined>(undefined)

let xterm: Terminal | undefined

/**
 * Handles installation stage updates from the desktop
 */
const updateInstallStage = (stageInfo: InstallStageInfo) => {
  installStage.value = stageInfo.stage
  installStageMessage.value = stageInfo.message || ''
  installStageProgress.value = stageInfo.progress
}

const currentStatusLabel = computed(() => {
  if (installStage.value && STAGE_METADATA[installStage.value]) {
    const metadata = STAGE_METADATA[installStage.value]
    return installStageMessage.value || metadata.description || metadata.label
  }
  return t(`serverStart.process.${status.value}`)
})

const isError = computed(
  () =>
    status.value === ProgressStatus.ERROR ||
    installStage.value === InstallStage.ERROR
)

const isInstallationStage = computed(() => {
  const installationStages: InstallStageType[] = [
    InstallStage.WELCOME_SCREEN,
    InstallStage.INSTALL_OPTIONS_SELECTION,
    InstallStage.CREATING_DIRECTORIES,
    InstallStage.INITIALIZING_CONFIG,
    InstallStage.PYTHON_ENVIRONMENT_SETUP,
    InstallStage.INSTALLING_REQUIREMENTS,
    InstallStage.MIGRATING_CUSTOM_NODES
  ]
  return (
    installStage.value !== null &&
    installationStages.includes(installStage.value)
  )
})

const displayTitle = computed(() => {
  if (isError.value) {
    return t('serverStart.errorMessage')
  }
  if (isInstallationStage.value) {
    return t('serverStart.installation.title')
  }
  return t('serverStart.title')
})

const displayStatusText = computed(() => {
  if (isError.value && electronVersion.value) {
    return `v${electronVersion.value}`
  }
  return currentStatusLabel.value
})

const installProgress = computed(() => {
  if (installStage.value && STAGE_METADATA[installStage.value]) {
    const metadata = STAGE_METADATA[installStage.value]

    // Only show determinate progress for installation-related stages
    const installationCategories = ['installation', 'validation']
    if (installationCategories.includes(metadata.category)) {
      return installStageProgress.value ?? metadata.progress
    }
  }
  return undefined
})

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

let cleanupInstallStageListener: (() => void) | undefined

onMounted(async () => {
  electron.sendReady()
  electron.onProgressUpdate(updateProgress)
  electronVersion.value = await electron.getElectronVersion()
  cleanupInstallStageListener =
    electron.InstallStage.onUpdate(updateInstallStage)
})

onUnmounted(() => {
  xterm?.dispose()
  if (cleanupInstallStageListener) {
    cleanupInstallStageListener()
  }
})
</script>

<style scoped>
:deep(.p-progressbar-indeterminate .p-progressbar-value),
:deep(.p-progressbar-determinate .p-progressbar-value) {
  background-color: #f0ff41;
}

/* Hide the xterm scrollbar completely */
:deep(.p-terminal) .xterm-viewport {
  overflow: hidden !important;
}
</style>
