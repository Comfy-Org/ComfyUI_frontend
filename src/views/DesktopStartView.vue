<template>
  <div
    class="w-screen h-screen grid items-center justify-around text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto overflow-y-auto"
  >
    <div class="max-w-screen-sm w-screen p-8">
      <ProgressBar mode="indeterminate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ProgressBar from 'primevue/progressbar'
</script>
