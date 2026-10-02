<script setup lang="ts">
const { width, height } = defineProps<{ width: number; height: number }>()
</script>

<template>
  <div class="size-full" style="container-type: size">
    <div
      class="relative mx-auto"
      :style="{
        width: `min(100cqw, calc(100cqh * ${width || 3} / ${height || 2}))`,
        aspectRatio: `${width || 3} / ${height || 2}`
      }"
    >
      <slot />
    </div>
  </div>
</template>
