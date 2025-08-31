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
      <div class="flex items-center justify-center">
        <ProgressBar mode="indeterminate" class="w-90 h-2" />
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
