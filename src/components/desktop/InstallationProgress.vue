<template>
  <div class="flex flex-col items-center justify-center min-h-screen px-8">
    <!-- Main Content Container -->
    <div class="w-full max-w-2xl">
      <!-- Split container with equal height sections -->
      <div class="flex flex-col items-center gap-16">
        <!-- Top half: Logo -->
        <img
          src="/assets/images/comfy-brand-mark.svg"
          alt="ComfyUI Logo"
          class="w-60 h-60"
        />
        <!-- Bottom half: Progress bar -->
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
