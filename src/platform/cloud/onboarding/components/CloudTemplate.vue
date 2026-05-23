<template>
  <div class="flex h-svh w-screen bg-charcoal-750 font-sans text-sand-500">
    <div class="relative flex flex-1 flex-col">
      <div class="flex h-16 shrink-0 items-center px-6">
        <CloudLogo class="h-5 w-auto text-brand-yellow md:h-6" />
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
import CloudLogo from '@/platform/cloud/onboarding/components/CloudLogo.vue'
import CloudTemplateFooter from '@/platform/cloud/onboarding/components/CloudTemplateFooter.vue'
</script>
<style>
@import '../assets/css/fonts.css';
</style>
