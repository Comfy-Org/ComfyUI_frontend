<script setup lang="ts">
import type { CatalogueFeature } from '@/lib/workshop/catalogue-features'

const { features, activeIndex, fill } = defineProps<{
  features: readonly CatalogueFeature[]
  activeIndex: number
  fill: number
}>()

const emit = defineEmits<{ go: [index: number] }>()

function barFill(index: number) {
  if (index < activeIndex) return 1
  return index === activeIndex ? fill : 0
}
</script>

<template>
  <div
    class="absolute inset-x-5 bottom-3 z-10 flex gap-2 sm:inset-x-8 sm:bottom-4"
    data-testid="featured-progress"
  >
    <button
      v-for="(feature, index) in features"
      :key="feature.key"
      type="button"
      :aria-label="feature.title"
      :aria-pressed="index === activeIndex"
      class="group/bar flex-1 cursor-pointer rounded-full py-3 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      @click="emit('go', index)"
    >
      <span
        class="block h-0.5 overflow-hidden rounded-full bg-primary-warm-white/25 transition-colors group-hover/bar:bg-primary-warm-white/50"
      >
        <span
          class="block h-full rounded-full bg-primary-warm-white"
          :style="{ width: `${barFill(index) * 100}%` }"
        />
      </span>
    </button>
  </div>
</template>
