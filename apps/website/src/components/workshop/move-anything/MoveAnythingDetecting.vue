<script setup lang="ts">
const { points, label } = defineProps<{
  points: readonly { x: number; y: number }[]
  label: string
}>()
</script>

<template>
  <div class="pointer-events-none absolute inset-0" role="status">
    <div
      v-for="(at, index) in points"
      :key="index"
      class="absolute"
      :style="{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }"
    >
      <span
        class="absolute size-16 -translate-1/2 animate-ping rounded-full bg-primary-comfy-yellow/30"
        aria-hidden="true"
      />
      <span
        class="absolute size-3 -translate-1/2 rounded-full bg-primary-comfy-yellow text-primary-comfy-yellow shadow-[0_0_12px_currentColor]"
        aria-hidden="true"
      />
      <span
        v-if="index === 0"
        class="absolute top-4 -translate-x-1/2 rounded-full bg-primary-comfy-ink/85 px-2 py-0.5 text-[10px] whitespace-nowrap text-primary-warm-white"
        >{{ label }}</span
      >
    </div>
  </div>
</template>
