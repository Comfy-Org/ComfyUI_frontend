<template>
  <div class="relative min-h-screen">
    <!-- Terminal Background Layer (always visible during loading) -->
    <div v-if="isLoading" class="fixed inset-0 overflow-hidden z-0">
      <div class="h-full w-full">
        <slot name="terminal"></slot>
      </div>
    </div>

    <!-- Semi-transparent overlay -->
    <div v-if="isLoading" class="fixed inset-0 bg-neutral-900/90 z-5"></div>

    <!-- Large oval shadow behind content -->
    <div
      v-if="isLoading"
      class="fixed z-8"
      style="
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 800px;
        height: 600px;
        background: rgb(23, 23, 23);
        border-radius: 50%;
        filter: blur(100px);
      "
    ></div>

    <!-- Main Content Layer -->
    <div
      class="relative flex items-center justify-center min-h-screen px-8 z-10"
    >
      <!-- Main startup display -->
      <div class="text-center space-y-4">
        <div class="flex flex-col items-center gap-8">
          <img
            src="/assets/images/comfy-brand-mark.svg"
            alt="ComfyUI Logo"
            class="w-60 h-60"
          />
          <!-- Indeterminate Progress Bar during server start -->
          <ProgressBar v-if="isLoading" mode="indeterminate" class="w-90 h-2" />
        </div>
        <h1
          class="text-4xl text-neutral-100"
          style="font-family: 'ABC ROM Black Italic', sans-serif"
        >
          {{ $t('serverStart.title') }}
        </h1>
        <p class="text-lg text-neutral-400">
          {{ currentStatusLabel }}
        </p>
      </div>

      <!-- Error Section (positioned at bottom) -->
      <div
        v-if="isError"
        class="absolute bottom-20 left-0 right-0 flex flex-col items-center gap-4"
      >
        <!-- Error Message -->
        <div
          class="bg-red-900/20 border border-red-800 rounded-lg p-4 mx-auto max-w-lg"
        >
          <p class="text-sm text-red-400 text-center">
            <i class="pi pi-exclamation-triangle mr-2"></i>
            {{ $t('serverStart.errorMessage') }}
            <span v-if="electronVersion">v{{ electronVersion }}</span>
          </p>
        </div>

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
import { ProgressStatus } from '@comfyorg/comfyui-electron-types'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Props
const props = defineProps<{
  status: ProgressStatus
  electronVersion?: string
  terminalVisible?: boolean
}>()

// Emits
defineEmits<{
  'report-issue': []
  'open-logs': []
  troubleshoot: []
  'toggle-terminal': [visible: boolean]
}>()

// Computed properties
const currentStatusLabel = computed(() =>
  t(`serverStart.process.${props.status}`)
)

const isLoading = computed(
  () =>
    props.status !== ProgressStatus.READY &&
    props.status !== ProgressStatus.ERROR
)

const isError = computed(() => props.status === ProgressStatus.ERROR)
</script>

<style scoped>
/* Override PrimeVue ProgressBar color to brand yellow */
:deep(.p-progressbar-indeterminate .p-progressbar-value) {
  background-color: #f0ff41;
}

/* Remove all padding from terminal components */
:deep(.p-terminal) {
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  background: transparent !important;
}

/* Style the terminal background for aesthetic effect */
:deep(.xterm) {
  background: black !important;
  padding: 0 !important;
  margin: 0 !important;
}

:deep(.xterm-viewport) {
  background: black !important;
  overflow: hidden !important;
  scrollbar-width: none !important; /* Firefox */
}

:deep(.xterm-viewport::-webkit-scrollbar) {
  display: none !important; /* Chrome, Safari, Edge */
}

:deep(.xterm-screen) {
  background: black !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* Hide all scrollbars in the terminal container */
:deep(.terminal-container) {
  overflow: hidden !important;
  scrollbar-width: none !important;
}

:deep(.terminal-container::-webkit-scrollbar) {
  display: none !important;
}
</style>
