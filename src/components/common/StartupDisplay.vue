<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="grid grid-rows-2 gap-8">
      <!-- Top container: Logo -->
      <div class="flex items-center justify-center">
        <img :src="logoSrc" :alt="logoAlt" class="w-60" />
      </div>
      <!-- Bottom container: Progress and text -->
      <div class="flex flex-col items-center justify-center gap-4">
        <ProgressBar
          v-if="showProgress"
          mode="indeterminate"
          class="w-90 h-2"
        />
        <h1
          v-if="title"
          class="text-3xl text-neutral-300"
          style="
            font-family: 'ABC ROM', sans-serif;
            font-weight: 500;
            font-style: italic;
          "
        >
          {{ title }}
        </h1>
        <p v-if="statusText" class="text-lg text-neutral-400">
          {{ statusText }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProgressBar from 'primevue/progressbar'

interface StartupDisplayProps {
  logoSrc?: string
  logoAlt?: string
  showProgress?: boolean
  title?: string
  statusText?: string
}

const {
  logoSrc = '/assets/images/comfy-brand-mark.svg',
  logoAlt = 'ComfyUI Logo',
  showProgress = true,
  title,
  statusText
} = defineProps<StartupDisplayProps>()
</script>

<style scoped>
/* Override PrimeVue ProgressBar color to brand yellow */
:deep(.p-progressbar-indeterminate .p-progressbar-value) {
  background-color: #f0ff41;
}
</style>
