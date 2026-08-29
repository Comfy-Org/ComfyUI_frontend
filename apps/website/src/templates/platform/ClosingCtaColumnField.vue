<script setup lang="ts">
import IsometricColumnIllustration from './IsometricColumnIllustration.vue'
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden"
    aria-hidden="true"
  >
    <div
      class="absolute top-1/2 -left-24 size-56 -translate-y-1/2 sm:-left-8 sm:size-72 lg:left-8 lg:size-80"
    >
      <IsometricColumnIllustration
        class="animate-platform-builder-float"
        style="
          --platform-column-grow-duration: 6.5s;
          --platform-column-grow-delay: -1.4s;
        "
      />
    </div>
    <div
      class="absolute top-1/2 -right-20 hidden size-52 -translate-y-1/2 sm:block lg:right-10 lg:size-60"
    >
      <IsometricColumnIllustration
        class="animate-platform-builder-float-delayed"
        style="
          --platform-column-grow-duration: 5.7s;
          --platform-column-grow-delay: -3.2s;
        "
      />
    </div>
  </div>
</template>
