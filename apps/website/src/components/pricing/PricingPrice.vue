<script setup lang="ts">
defineProps<{
  price: string
  period: string
  originalPrice?: string
}>()
</script>

<template>
  <div class="mt-6 flex items-baseline gap-2">
    <span class="font-formula text-5xl font-light text-primary-comfy-canvas">
      {{ price }}
    </span>
    <span
      v-if="originalPrice"
      class="font-formula text-primary-warm-gray text-sm font-light line-through"
    >
      {{ originalPrice }}
    </span>
    <span class="text-primary-warm-white text-sm">
      {{ period }}
    </span>
  </div>
</template>
