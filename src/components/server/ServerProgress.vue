<template>
  <div class="flex flex-col items-center justify-center min-h-screen px-8">
    <!-- Main Content Container -->
    <div class="w-full max-w-2xl space-y-8">
      <!-- ComfyUI Logo and Title -->
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
          class="text-4xl text-white"
          style="font-family: 'ABC ROM Black Italic', sans-serif"
        >
          {{ $t('serverStart.title') }}
        </h1>
        <p class="text-lg text-neutral-400">
          {{ currentStatusLabel }}
        </p>
      </div>

      <!-- Error Message -->
      <div
        v-if="isError"
        class="bg-red-900/20 border border-red-800 rounded-lg p-4 mx-auto max-w-lg"
      >
        <p class="text-sm text-red-400 text-center">
          <i class="pi pi-exclamation-triangle mr-2"></i>
          {{ $t('serverStart.errorMessage') }}
          <span v-if="electronVersion">v{{ electronVersion }}</span>
        </p>
      </div>

      <!-- Action Buttons (for error states) -->
      <div v-if="isError" class="flex gap-4 justify-center">
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
          v-if="!terminalVisible && isError"
          class="text-sm text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-2 mx-auto"
          @click="$emit('toggle-terminal', true)"
        >
          <i class="pi pi-search"></i>
          {{ $t('serverStart.showTerminal') }}
        </button>
      </div>
    </div>

    <!-- Terminal Output (passed as slot) -->
    <div v-if="terminalVisible" class="w-full max-w-4xl mt-8">
      <slot name="terminal"></slot>
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
</style>
