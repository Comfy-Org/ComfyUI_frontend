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
          <div v-if="isLoading" class="w-90 h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div class="h-full bg-[#F0FF41] rounded-full animate-indeterminate-progress"></div>
          </div>
        </div>
        <h1 class="text-4xl font-bold text-white">ComfyUI Server</h1>
        <p class="text-lg text-neutral-400">
          {{ currentStatusLabel }}
        </p>
      </div>

      <!-- Progress Bar Container -->
      <div class="space-y-4">
        <!-- Main Progress Bar -->
        <div class="relative">
          <div class="w-full bg-neutral-800 rounded-full h-3 overflow-hidden">
            <div
              class="h-full bg-gradient-to-r transition-all duration-500 ease-out rounded-full relative overflow-hidden"
              :class="progressBarClass"
              :style="{ width: `${displayProgress}%` }"
            >
              <!-- Shimmer effect for active progress -->
              <div
                v-if="isLoading && !isError"
                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              ></div>
            </div>
          </div>
          <!-- Progress percentage -->
          <div
            class="absolute -top-8 transition-all duration-300"
            :style="{ left: `${Math.min(displayProgress, 95)}%` }"
          >
            <span class="text-sm font-semibold text-white">
              {{ Math.round(displayProgress) }}%
            </span>
          </div>
        </div>

        <!-- Status Details -->
        <div
          class="bg-neutral-900/50 rounded-lg p-6 backdrop-blur-sm border border-neutral-800"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-white mb-2">
                {{ statusMetadata.label }}
              </h3>
              <p class="text-sm text-neutral-400">
                {{ statusMetadata.description }}
              </p>

              <!-- Error message with version info -->
              <div v-if="isError" class="mt-4">
                <div class="bg-red-900/20 border border-red-800 rounded-lg p-4">
                  <p class="text-sm text-red-400">
                    <i class="pi pi-exclamation-triangle mr-2"></i>
                    {{ $t('serverStart.errorMessage') }}
                    <span v-if="electronVersion">v{{ electronVersion }}</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Status Icon -->
            <div class="ml-4">
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300"
                :class="statusIconClass"
              >
                <i :class="statusIcon" class="text-xl"></i>
              </div>
            </div>
          </div>
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
import { computed, ref, watch } from 'vue'
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

// State for animated progress
const displayProgress = ref(0)

// Status metadata mapping
const STATUS_METADATA: Record<
  ProgressStatus,
  { label: string; description: string; progress: number }
> = {
  [ProgressStatus.INITIAL_STATE]: {
    label: t('serverStart.status.initializing'),
    description: t('serverStart.statusDescriptions.initializing'),
    progress: 10
  },
  [ProgressStatus.PYTHON_SETUP]: {
    label: t('serverStart.status.settingUpPython'),
    description: t('serverStart.statusDescriptions.settingUpPython'),
    progress: 30
  },
  [ProgressStatus.STARTING_SERVER]: {
    label: t('serverStart.status.startingServer'),
    description: t('serverStart.statusDescriptions.startingServer'),
    progress: 60
  },
  [ProgressStatus.READY]: {
    label: t('serverStart.status.ready'),
    description: t('serverStart.statusDescriptions.ready'),
    progress: 100
  },
  [ProgressStatus.ERROR]: {
    label: t('serverStart.status.error'),
    description: t('serverStart.statusDescriptions.error'),
    progress: 0
  }
}

// Computed properties
const statusMetadata = computed(() => {
  return (
    STATUS_METADATA[props.status] ||
    STATUS_METADATA[ProgressStatus.INITIAL_STATE]
  )
})

const currentStatusLabel = computed(() => {
  return t(`serverStart.process.${props.status}`)
})

const isLoading = computed(() => {
  return (
    props.status !== ProgressStatus.READY &&
    props.status !== ProgressStatus.ERROR
  )
})

const isError = computed(() => props.status === ProgressStatus.ERROR)
const isReady = computed(() => props.status === ProgressStatus.READY)

// Progress bar styling
const progressBarClass = computed(() => {
  if (isError.value) return 'from-red-600 to-red-500'
  if (isReady.value) return 'from-green-600 to-green-500'

  const progress = displayProgress.value
  if (progress < 30) return 'from-blue-600 to-purple-600'
  if (progress < 60) return 'from-purple-600 to-indigo-600'
  return 'from-indigo-600 to-blue-600'
})

// Status icon
const statusIcon = computed(() => {
  if (isError.value) return 'pi pi-times'
  if (isReady.value) return 'pi pi-check'
  if (isLoading.value) return 'pi pi-spin pi-spinner'
  return 'pi pi-circle'
})

const statusIconClass = computed(() => {
  if (isError.value) return 'bg-red-900/50 text-red-400 border border-red-800'
  if (isReady.value)
    return 'bg-green-900/50 text-green-400 border border-green-800'
  if (isLoading.value)
    return 'bg-blue-900/50 text-blue-400 border border-blue-800'
  return 'bg-neutral-900/50 text-neutral-400 border border-neutral-800'
})

// Animate progress changes
watch(
  () => statusMetadata.value.progress,
  (newProgress) => {
    const startProgress = displayProgress.value
    const endProgress = newProgress
    const duration = 500 // ms
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3)

      displayProgress.value =
        startProgress + (endProgress - startProgress) * eased

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
  },
  { immediate: true }
)
</script>

<style scoped>
/* Shimmer animation for progress bar */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(200%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

/* Indeterminate progress animation */
@keyframes indeterminate-progress {
  0% {
    transform: translateX(-100%);
    width: 30%;
  }
  50% {
    transform: translateX(100%);
    width: 30%;
  }
  100% {
    transform: translateX(250%);
    width: 30%;
  }
}

.animate-indeterminate-progress {
  animation: indeterminate-progress 1.5s ease-in-out infinite;
}
</style>
