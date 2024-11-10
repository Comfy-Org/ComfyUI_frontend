<template>
  <div class="flex flex-col items-center justify-center gap-8 p-8">
    <!-- Header -->
    <h1 class="text-4xl font-bold text-neutral-100">Welcome to ComfyUI</h1>

    <!-- Get Started Button -->
    <Button
      label="Get Started"
      icon="pi pi-arrow-right"
      iconPos="right"
      size="large"
      @click="$emit('start')"
      class="p-4 text-lg"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
defineEmits(['start'])
</script>
