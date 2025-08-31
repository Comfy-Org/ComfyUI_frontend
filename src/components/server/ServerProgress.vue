<template>
  <div class="flex items-center justify-center min-h-screen px-8 relative">
    <!-- Main startup display -->
    <StartupDisplay
      :show-progress="isLoading"
      :title="$t('serverStart.title')"
      :status-text="currentStatusLabel"
    />

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

    <!-- Terminal Output (positioned at bottom) -->
    <div
      v-if="terminalVisible"
      class="absolute bottom-4 left-4 right-4 max-w-4xl mx-auto"
    >
      <slot name="terminal"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ProgressStatus } from '@comfyorg/comfyui-electron-types'
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import StartupDisplay from '@/components/common/StartupDisplay.vue'

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
