<template>
  <div :class="wrapperClass">
    <div class="grid grid-rows-2 gap-8">
      <!-- Top container: Logo -->
      <div class="flex items-end justify-center">
        <img
          src="/assets/images/comfy-brand-mark.svg"
          :alt="t('g.logoAlt')"
          class="w-60"
        >
      </div>
      <!-- Bottom container: Progress and text -->
      <div class="flex flex-col items-center justify-center gap-4">
        <ProgressBar
          v-if="!hideProgress"
          :mode="progressMode"
          :value="progressPercentage ?? 0"
          :show-value="false"
          class="mt-8 h-2 w-90"
          :pt="{ value: { class: 'bg-brand-yellow' } }"
        />
        <h1
          v-if="title"
          class="font-inter text-3xl font-bold text-neutral-300"
        >
          {{ title }}
        </h1>
        <p
          v-if="statusText"
          class="text-lg text-neutral-400"
          data-testid="startup-status-text"
        >
          {{ statusText }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProgressBar from 'primevue/progressbar'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

/** Props for the StartupDisplay component */
interface StartupDisplayProps {
  /** Progress: 0-100 for determinate, undefined for indeterminate */
  progressPercentage?: number
  /** Main title text */
  title?: string
  /** Status text shown below the title */
  statusText?: string
  /** Hide the progress bar */
  hideProgress?: boolean
  /** Use full screen wrapper (default: true) */
  fullScreen?: boolean
}

const {
  progressPercentage,
  title,
  statusText,
  hideProgress = false,
  fullScreen = true
} = defineProps<StartupDisplayProps>()

const progressMode = computed(() =>
  progressPercentage === undefined ? 'indeterminate' : 'determinate'
)

const wrapperClass = computed(() =>
  fullScreen
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center'
)
</script>
