<script setup lang="ts">
const { colors } = defineProps<{ colors: readonly string[] }>()
</script>

<template>
  <span class="-ml-0.5 flex items-center" aria-hidden="true">
    <span
      v-for="(color, index) in colors.slice(0, 3)"
      :key="index"
      class="size-3 rounded-full border border-primary-comfy-ink-light not-first:-ml-1"
      :style="{ backgroundColor: color }"
    />
  </span>
</template>
