<script setup lang="ts">
const { title, description } = defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h2
        id="explore-results"
        class="text-xl font-medium text-primary-warm-white"
      >
        {{ title }}
      </h2>
      <p v-if="description" class="text-sm text-content-secondary">
        {{ description }}
      </p>
    </div>
    <slot />
  </div>
</template>
