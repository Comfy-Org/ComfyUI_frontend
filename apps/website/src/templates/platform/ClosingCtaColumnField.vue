<script setup lang="ts">
import IsometricColumnIllustration from './IsometricColumnIllustration.vue'
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden"
    aria-hidden="true"
  >
    <div
      class="absolute top-1/2 -left-20 size-52 -translate-y-1/2 sm:-left-8 sm:size-60 lg:left-6"
    >
      <IsometricColumnIllustration
        class="animate-platform-builder-float"
        style="
          --platform-column-grow-duration: 5.8s;
          --platform-column-grow-delay: -1.2s;
          --platform-ring-offset: -0.4s;
        "
      />
    </div>
    <div class="absolute bottom-8 left-1/5 hidden size-36 lg:block">
      <IsometricColumnIllustration
        class="animate-platform-builder-float-delayed"
        style="
          --platform-column-grow-duration: 6.7s;
          --platform-column-grow-delay: -4.1s;
          --platform-ring-offset: -2.1s;
        "
      />
    </div>
    <div
      class="absolute top-1/2 -right-16 hidden size-48 -translate-y-1/2 sm:block lg:right-6 lg:size-52"
    >
      <IsometricColumnIllustration
        class="animate-platform-builder-float-delayed"
        style="
          --platform-column-grow-duration: 6.2s;
          --platform-column-grow-delay: -3.4s;
          --platform-ring-offset: -1.2s;
        "
      />
    </div>
    <div class="absolute right-[17%] bottom-6 hidden size-36 lg:block">
      <IsometricColumnIllustration
        class="animate-platform-builder-float-slow"
        style="
          --platform-column-grow-duration: 5.4s;
          --platform-column-grow-delay: -2.3s;
          --platform-ring-offset: -3s;
        "
      />
    </div>
  </div>
</template>
