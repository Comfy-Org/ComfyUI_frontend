<template>
  <div class="w-full overflow-hidden rounded-xs bg-accent">
    <div
      class="h-full bg-foreground transition-[width] duration-200 ease-linear"
      :style="{ width: `${percent}%` }"
    />
  </div>
</template>

<script setup lang="ts">
const { percent } = defineProps<{
  percent: number
}>()
</script>
