<template>
  <div class="flex flex-col items-center justify-center min-h-screen px-8">
    <!-- Main Content Container -->
    <div class="w-full max-w-2xl">
      <!-- Split container with equal height sections -->
      <div class="flex flex-col items-center">
        <!-- Top half: Logo container -->
        <div class="h-64 flex items-end justify-center pb-8">
          <img
            src="/assets/images/comfy-brand-mark.svg"
            alt="ComfyUI Logo"
            class="w-60 h-60"
          />
        </div>
        <!-- Bottom half: Progress bar container -->
        <div class="h-64 flex items-start justify-center pt-8">
          <ProgressBar mode="indeterminate" class="w-90 h-2" />
        </div>
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
