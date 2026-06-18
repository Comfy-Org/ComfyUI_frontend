<script setup lang="ts">
const { title } = defineProps<{ title: string }>()
</script>

<template>
  <section
    class="flex items-center justify-center px-6 pt-20 pb-16 lg:pt-32 lg:pb-24"
  >
    <h1 class="text-primary-comfy-canvas text-4xl font-light lg:text-6xl">
      {{ title }}
    </h1>
  </section>
</template>
