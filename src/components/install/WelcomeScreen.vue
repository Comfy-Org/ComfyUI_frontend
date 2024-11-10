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

    <!-- Installation Steps -->
    <div class="w-[600px]">
      <Steps :model="installSteps" :readonly="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Steps from 'primevue/steps'
import Button from 'primevue/button'

const installSteps = [
  {
    label: 'Install Location',
    icon: 'pi pi-folder'
  },
  {
    label: 'Migration',
    icon: 'pi pi-download'
  },
  {
    label: 'Desktop Settings',
    icon: 'pi pi-desktop'
  },
  {
    label: 'Review',
    icon: 'pi pi-check'
  }
]

defineEmits(['start'])
</script>
