<template>
  <div class="relative min-h-screen">
    <!-- Terminal Background Layer (always visible during loading) -->
    <div v-if="!isError" class="fixed inset-0 overflow-hidden z-0">
      <div class="h-full w-full">
        <slot name="terminal"></slot>
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

    <!-- Main Content Layer -->
    <div class="relative z-10">
      <!-- Main startup display using StartupDisplay component -->
      <StartupDisplay
        :title="displayTitle"
        :status-text="displayStatusText"
        :hide-progress="isError"
      />

      <!-- Error Section (positioned at bottom) -->
      <div
        v-if="isError"
        class="absolute bottom-20 left-0 right-0 flex flex-col items-center gap-4"
      >
        <!-- Action Buttons (for error states) -->
        <div class="flex gap-4 justify-center">
          <Button
            icon="pi pi-flag"
            :label="$t('serverStart.reportIssue')"
            severity="secondary"
            @click="$emit('report-issue')"
          />
          <Button
            icon="pi pi-file"
            :label="$t('serverStart.openLogs')"
            severity="secondary"
            @click="$emit('open-logs')"
          />
          <Button
            icon="pi pi-wrench"
            :label="$t('serverStart.troubleshoot')"
            @click="$emit('troubleshoot')"
          />
        </div>

        <!-- Terminal Toggle -->
        <div class="text-center">
          <button
            v-if="!terminalVisible"
            class="text-sm text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-2 mx-auto"
            @click="$emit('toggle-terminal', true)"
          >
            <i class="pi pi-search"></i>
            {{ $t('serverStart.showTerminal') }}
          </button>
        </div>
      </div>

      <!-- Terminal Output (positioned at bottom when manually toggled) -->
      <div
        v-if="terminalVisible && isError"
        class="absolute bottom-4 left-4 right-4 max-w-4xl mx-auto z-10"
      >
        <div class="bg-neutral-900/95 rounded-lg p-4 border border-neutral-700">
          <slot name="terminal"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  InstallStage,
  type InstallStageInfo,
  type InstallStageType,
  ProgressStatus
} from '@comfyorg/comfyui-electron-types'
import Button from 'primevue/button'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import StartupDisplay from '@/components/common/StartupDisplay.vue'
import { STAGE_METADATA } from '@/types/installStageTypes'
import { electronAPI } from '@/utils/envUtil'

const { t } = useI18n()
const electron = electronAPI()

// Props
const props = defineProps<{
  status: ProgressStatus
  electronVersion?: string
  terminalVisible?: boolean
}>()

// Local state for installation stages
const installStage = ref<InstallStageType | null>(null)
const installStageMessage = ref<string>('')

// Emits
defineEmits<{
  'report-issue': []
  'open-logs': []
  troubleshoot: []
  'toggle-terminal': [visible: boolean]
}>()

// Handle installation stage updates
const updateInstallStage = (stageInfo: InstallStageInfo) => {
  installStage.value = stageInfo.stage
  installStageMessage.value = stageInfo.message || ''
}

// Computed properties
const currentStatusLabel = computed(() => {
  // If we have an installation stage, use its metadata
  if (installStage.value && STAGE_METADATA[installStage.value]) {
    const metadata = STAGE_METADATA[installStage.value]
    // Use custom message if provided, otherwise use the stage description
    return installStageMessage.value || metadata.description || metadata.label
  }
  // Fallback to the old progress status message
  return t(`serverStart.process.${props.status}`)
})

const isError = computed(
  () =>
    props.status === ProgressStatus.ERROR ||
    installStage.value === InstallStage.ERROR
)

// Display properties for StartupDisplay component
const displayTitle = computed(() => {
  if (isError.value) {
    return t('serverStart.errorMessage')
  }
  // Use the stage label as title if we're in an installation stage
  if (installStage.value && STAGE_METADATA[installStage.value]) {
    // For certain installation stages, use custom titles
    const installationStages: InstallStageType[] = [
      InstallStage.INSTALL_OPTIONS_SELECTION,
      InstallStage.CREATING_DIRECTORIES,
      InstallStage.INITIALIZING_CONFIG,
      InstallStage.PYTHON_ENVIRONMENT_SETUP,
      InstallStage.INSTALLING_REQUIREMENTS,
      InstallStage.MIGRATING_CUSTOM_NODES
    ]
    if (installationStages.includes(installStage.value)) {
      return t('serverStart.installation.title')
    }
  }
  return t('serverStart.title')
})

const displayStatusText = computed(() => {
  if (isError.value && props.electronVersion) {
    return `v${props.electronVersion}`
  }
  return currentStatusLabel.value
})

// Store cleanup function for InstallStage listener
let cleanupInstallStageListener: (() => void) | undefined

// Lifecycle hooks
onMounted(() => {
  // Listen for installation stage updates
  if (electron.InstallStage?.onUpdate) {
    cleanupInstallStageListener =
      electron.InstallStage.onUpdate(updateInstallStage)
  }
})

onUnmounted(() => {
  // Clean up InstallStage listener using the returned cleanup function
  if (cleanupInstallStageListener) {
    cleanupInstallStageListener()
  }
})
</script>

<style scoped>
/* Override PrimeVue ProgressBar color to brand yellow */
:deep(.p-progressbar-indeterminate .p-progressbar-value) {
  background-color: #f0ff41;
}

/* Hide the xterm scrollbar completely */
:deep(.p-terminal) .xterm-viewport {
  overflow: hidden !important;
}
</style>
