<template>
  <div class="flex flex-col items-center justify-center min-h-screen px-8">
    <!-- Main Content Container -->
    <div class="w-full max-w-2xl space-y-8">
      <!-- ComfyUI Logo and Title -->
      <div class="text-center space-y-4">
        <div class="flex justify-center mb-4">
          <div
            class="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl transform transition-transform"
            :class="{ 'animate-pulse': isInstalling }"
          >
            <i class="pi pi-box text-5xl text-white"></i>
          </div>
        </div>
        <h1 class="text-4xl font-bold text-white">ComfyUI</h1>
        <p class="text-lg text-neutral-400">
          {{ currentStageLabel }}
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
                v-if="isInstalling && !isError"
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

        <!-- Stage Details -->
        <div
          class="bg-neutral-900/50 rounded-lg p-6 backdrop-blur-sm border border-neutral-800"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-white mb-2">
                {{ currentStageMetadata.label }}
              </h3>
              <p class="text-sm text-neutral-400">
                {{ currentStageDescription }}
              </p>

              <!-- Additional message if provided -->
              <p v-if="stageInfo?.message" class="text-sm text-blue-400 mt-2">
                {{ stageInfo.message }}
              </p>

              <!-- Error message -->
              <div v-if="isError && stageInfo?.error" class="mt-4">
                <div class="bg-red-900/20 border border-red-800 rounded-lg p-4">
                  <p class="text-sm text-red-400">
                    <i class="pi pi-exclamation-triangle mr-2"></i>
                    {{ stageInfo.error }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Stage Status Icon -->
            <div class="ml-4">
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300"
                :class="statusIconClass"
              >
                <i :class="statusIcon" class="text-xl"></i>
              </div>
            </div>
          </div>

          <!-- Stage History (collapsible) -->
          <div v-if="stageHistory.length > 1" class="mt-6">
            <button
              class="text-sm text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-2"
              @click="showHistory = !showHistory"
            >
              <i
                :class="
                  showHistory ? 'pi pi-chevron-down' : 'pi pi-chevron-right'
                "
              ></i>
              {{
                showHistory
                  ? $t('installationProgress.hideSteps')
                  : $t('installationProgress.showSteps')
              }}
              {{ $t('installationProgress.installationSteps') }}
            </button>

            <Transition name="slide-fade">
              <div v-if="showHistory" class="mt-4 space-y-2">
                <div
                  v-for="(stage, index) in completedStages"
                  :key="index"
                  class="flex items-center gap-3 text-sm"
                >
                  <i class="pi pi-check-circle text-green-500"></i>
                  <span class="text-neutral-400">{{ stage.label }}</span>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Action Buttons (for error/maintenance states) -->
        <div v-if="isError || isMaintenance" class="flex gap-4 justify-center">
          <Button
            v-if="isError"
            icon="pi pi-flag"
            :label="$t('installationProgress.reportIssue')"
            severity="secondary"
            @click="reportIssue"
          />
          <Button
            v-if="isError"
            icon="pi pi-file"
            :label="$t('installationProgress.viewLogs')"
            severity="secondary"
            @click="openLogs"
          />
          <Button
            v-if="isMaintenance"
            icon="pi pi-wrench"
            :label="$t('installationProgress.troubleshoot')"
            @click="troubleshoot"
          />
        </div>

        <!-- Terminal Toggle (for debugging) -->
        <div v-if="isDevelopment" class="text-center">
          <button
            class="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
            @click="showTerminal = !showTerminal"
          >
            <i class="pi pi-terminal mr-1"></i>
            {{
              showTerminal
                ? $t('installationProgress.hideTerminal')
                : $t('installationProgress.showTerminal')
            }}
            {{ $t('installationProgress.terminalOutput') }}
          </button>
        </div>
      </div>

      <!-- Stage Category Pills -->
      <div class="flex justify-center gap-2 flex-wrap">
        <div
          v-for="category in categories"
          :key="category.name"
          class="px-3 py-1 rounded-full text-xs font-medium transition-all duration-300"
          :class="getCategoryClass(category.name)"
        >
          {{ category.label }}
        </div>
      </div>
    </div>

    <!-- Terminal Output (Development Mode) -->
    <Transition name="slide-fade">
      <div
        v-if="showTerminal && isDevelopment"
        class="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm border-t border-neutral-800 p-4 max-h-64 overflow-y-auto font-mono text-xs text-green-400"
      >
        <div class="max-w-4xl mx-auto">
          <div class="mb-2 text-neutral-500">
            {{ $t('installationProgress.debugOutput') }}
          </div>
          <pre>{{ JSON.stringify(stageInfo, null, 2) }}</pre>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  type InstallStageInfo,
  type InstallStageType,
  STAGE_METADATA
} from '@/types/installStageTypes'
import { electronAPI, isElectron } from '@/utils/envUtil'

const electron = electronAPI()
const { t } = useI18n()

// State
const stageInfo = ref<InstallStageInfo | null>(null)
const showHistory = ref(false)
const showTerminal = ref(false)
const stageHistory = ref<InstallStageType[]>([])
const displayProgress = ref(0)

// Environment checks
const isDevelopment = import.meta.env.DEV

// Computed properties
const currentStage = computed(() => stageInfo.value?.stage || 'idle')

const currentStageMetadata = computed(() => {
  return STAGE_METADATA[currentStage.value] || STAGE_METADATA.idle
})

const currentStageLabel = computed(() => {
  const stage = currentStage.value
  if (stage === 'ready') {
    return t('installationProgress.labels.installationComplete')
  }
  if (stage === 'error') {
    return t('installationProgress.labels.installationError')
  }
  if (stage === 'maintenance_mode') {
    return t('installationProgress.labels.maintenanceRequired')
  }
  return t(`installationProgress.stages.${stage}`)
})

const currentStageDescription = computed(() => {
  const stage = currentStage.value
  const descKey = `installationProgress.stageDescriptions.${stage}`
  // Check if translation exists, otherwise return empty string
  return t(descKey) !== descKey ? t(descKey) : ''
})

const isInstalling = computed(() => {
  const stage = currentStage.value
  return (
    stage !== 'idle' &&
    stage !== 'ready' &&
    stage !== 'error' &&
    stage !== 'maintenance_mode'
  )
})

const isError = computed(() => currentStage.value === 'error')
const isMaintenance = computed(() => currentStage.value === 'maintenance_mode')
const isReady = computed(() => currentStage.value === 'ready')

const completedStages = computed(() => {
  return stageHistory.value
    .slice(0, -1) // Exclude current stage
    .map((stage) => STAGE_METADATA[stage])
    .filter((meta) => meta && meta.category !== 'error')
})

// Progress bar styling
const progressBarClass = computed(() => {
  if (isError.value) return 'from-red-600 to-red-500'
  if (isMaintenance.value) return 'from-yellow-600 to-yellow-500'
  if (isReady.value) return 'from-green-600 to-green-500'

  // Different gradients based on progress
  const progress = displayProgress.value
  if (progress < 30) return 'from-blue-600 to-purple-600'
  if (progress < 60) return 'from-purple-600 to-indigo-600'
  if (progress < 90) return 'from-indigo-600 to-blue-600'
  return 'from-blue-600 to-green-600'
})

// Status icon
const statusIcon = computed(() => {
  if (isError.value) return 'pi pi-times'
  if (isMaintenance.value) return 'pi pi-wrench'
  if (isReady.value) return 'pi pi-check'
  if (isInstalling.value) return 'pi pi-spin pi-spinner'
  return 'pi pi-circle'
})

const statusIconClass = computed(() => {
  if (isError.value) return 'bg-red-900/50 text-red-400 border border-red-800'
  if (isMaintenance.value)
    return 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
  if (isReady.value)
    return 'bg-green-900/50 text-green-400 border border-green-800'
  if (isInstalling.value)
    return 'bg-blue-900/50 text-blue-400 border border-blue-800'
  return 'bg-neutral-900/50 text-neutral-400 border border-neutral-800'
})

// Categories for progress indicators
const categories = computed(() => [
  {
    name: 'initialization',
    label: t('installationProgress.categories.initialization')
  },
  {
    name: 'validation',
    label: t('installationProgress.categories.validation')
  },
  {
    name: 'installation',
    label: t('installationProgress.categories.installation')
  },
  { name: 'completion', label: t('installationProgress.categories.completion') }
])

const getCategoryClass = (categoryName: string) => {
  const metadata = currentStageMetadata.value
  const isActive = metadata.category === categoryName
  const categoryProgress = displayProgress.value

  // Check if this category has been completed
  let isCompleted = false
  if (categoryName === 'initialization' && categoryProgress > 25)
    isCompleted = true
  if (categoryName === 'validation' && categoryProgress > 90) isCompleted = true
  if (categoryName === 'installation' && categoryProgress > 70)
    isCompleted = true
  if (categoryName === 'completion' && categoryProgress >= 100)
    isCompleted = true

  if (isActive) {
    return 'bg-blue-600 text-white border border-blue-500'
  }
  if (isCompleted) {
    return 'bg-green-900/30 text-green-400 border border-green-800'
  }
  return 'bg-neutral-900/30 text-neutral-600 border border-neutral-800'
}

// Update stage handler
const updateStage = (info: InstallStageInfo) => {
  stageInfo.value = info

  // Track stage history
  if (!stageHistory.value.includes(info.stage)) {
    stageHistory.value.push(info.stage)
  }
}

// Animate progress changes
watch(
  () => currentStageMetadata.value.progress,
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
  }
)

// Action handlers
const reportIssue = () => {
  window.open('https://forum.comfy.org/c/v1-feedback/', '_blank')
}

const openLogs = () => {
  electron.openLogsFolder()
}

const troubleshoot = () => {
  void electron.startTroubleshooting()
}

// Initialize installation stage tracking
onMounted(async () => {
  if (!isElectron()) return

  // Get current stage
  const currentStageInfo = await electron.InstallStage?.getCurrent()
  if (currentStageInfo) {
    updateStage(currentStageInfo)
  }

  // Subscribe to updates
  electron.InstallStage?.onUpdate((info: InstallStageInfo) => {
    updateStage(info)
  })
})

// Cleanup
onUnmounted(() => {
  if (!isElectron()) return
  electron.InstallStage?.dispose()
})
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

/* Slide fade transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(10px);
  opacity: 0;
}
</style>
