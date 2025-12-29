<template>
  <div ref="containerRef" class="relative size-full min-h-32 overflow-hidden">
    <div v-if="beforeImage || afterImage">
      <img
        v-if="afterImage"
        :src="afterImage"
        :alt="afterAlt"
        draggable="false"
        class="size-full object-contain"
      />

      <img
        v-if="beforeImage"
        :src="beforeImage"
        :alt="beforeAlt"
        draggable="false"
        class="absolute inset-0 size-full object-contain"
        :style="{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }"
      />

      <div
        class="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white shadow-md"
        :style="{ left: `${sliderPosition}%` }"
        role="presentation"
      />
    </div>

    <div v-else class="flex size-full items-center justify-center">
      {{ $t('imageCompare.noImages') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouseInElement } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

export interface ImageCompareValue {
  before: string
  after: string
  beforeAlt?: string
  afterAlt?: string
  initialPosition?: number
}

// Image compare widgets typically don't have v-model, they display comparison
const props = defineProps<{
  widget: SimplifiedWidget<ImageCompareValue | string>
}>()

const containerRef = ref<HTMLElement | null>(null)
const sliderPosition = ref(50)

const { elementX, elementWidth, isOutside } = useMouseInElement(containerRef)

watch([elementX, elementWidth, isOutside], ([x, width, outside]) => {
  if (!outside && width > 0) {
    sliderPosition.value = Math.max(0, Math.min(100, (x / width) * 100))
  }
})

const beforeImage = computed(() => {
  const value = props.widget.value
  return typeof value === 'string' ? value : value?.before || ''
})

const afterImage = computed(() => {
  const value = props.widget.value
  return typeof value === 'string' ? '' : value?.after || ''
})

const beforeAlt = computed(() => {
  const value = props.widget.value
  return typeof value === 'object' && value?.beforeAlt
    ? value.beforeAlt
    : 'Before image'
})

const afterAlt = computed(() => {
  const value = props.widget.value
  return typeof value === 'object' && value?.afterAlt
    ? value.afterAlt
    : 'After image'
})
</script>
