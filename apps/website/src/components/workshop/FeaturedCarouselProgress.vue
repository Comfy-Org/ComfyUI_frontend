<script setup lang="ts">
const { count, activeIndex, fill } = defineProps<{
  count: number
  activeIndex: number
  fill: number
}>()

function barFill(index: number) {
  if (index < activeIndex) return 1
  return index === activeIndex ? fill : 0
}
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-5 bottom-6 flex gap-2 sm:inset-x-8"
    aria-hidden="true"
    data-testid="featured-progress"
  >
    <span
      v-for="index in count"
      :key="index"
      class="h-0.5 flex-1 overflow-hidden rounded-full bg-primary-warm-white/25"
    >
      <span
        class="block h-full rounded-full bg-primary-warm-white"
        :style="{ width: `${barFill(index - 1) * 100}%` }"
      />
    </span>
  </div>
</template>
