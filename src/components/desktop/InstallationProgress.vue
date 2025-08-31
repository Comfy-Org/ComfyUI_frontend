<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="grid grid-rows-2 gap-8">
      <!-- Top container -->
      <div class="flex items-center justify-center">
        <img
          src="/assets/images/comfy-brand-mark.svg"
          alt="ComfyUI Logo"
          class="w-60"
        />
      </div>
      <!-- Bottom container -->
      <div class="flex flex-col items-center justify-center gap-4">
        <ProgressBar mode="indeterminate" class="w-90 h-2" />
        <h1
          class="text-4xl text-neutral-300"
          style="font-family: 'ABC ROM Black Italic', sans-serif"
        >
          {{ $t('desktopStart.initialising') }}
        </h1>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProgressBar from 'primevue/progressbar'
</script>

<style scoped>
/* Override PrimeVue ProgressBar color to brand yellow */
:deep(.p-progressbar-indeterminate .p-progressbar-value) {
  background-color: #f0ff41;
}
</style>
