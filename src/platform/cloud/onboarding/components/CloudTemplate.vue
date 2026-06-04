<template>
  <div
    class="flex h-svh w-screen bg-primary-comfy-ink font-sans text-primary-comfy-canvas"
  >
    <div class="relative flex flex-1 flex-col">
      <div class="flex h-16 shrink-0 items-center px-6">
        <i
          class="icon-[comfy--comfy-logo] h-5 w-22 text-brand-yellow md:h-6 md:w-26"
        />
      </div>
      <div class="flex flex-1 items-center justify-center overflow-auto">
        <slot />
      </div>
      <CloudTemplateFooter />
    </div>
    <div class="relative hidden flex-1 overflow-hidden py-2 pr-2 lg:block">
      <CloudHeroCarousel />
    </div>
  </div>
</template>

<script setup lang="ts">
import CloudHeroCarousel from '@/platform/cloud/onboarding/components/CloudHeroCarousel.vue'
import CloudTemplateFooter from '@/platform/cloud/onboarding/components/CloudTemplateFooter.vue'
</script>
<style>
@import '../assets/css/fonts.css';
</style>
