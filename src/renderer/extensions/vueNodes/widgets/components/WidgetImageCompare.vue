<template>
  <div class="flex size-full min-h-32 flex-col overflow-hidden">
    <div
      v-if="showBatchNav"
      class="flex shrink-0 justify-between px-2 py-1 text-xs"
      data-testid="batch-nav"
    >
      <BatchNavigation
        v-model="beforeIndex"
        :count="beforeBatchCount"
        data-testid="before-batch"
      >
        <template #label>{{ $t('imageCompare.batchLabelA') }}</template>
      </BatchNavigation>
      <div v-if="beforeBatchCount <= 1" />

      <BatchNavigation
        v-model="afterIndex"
        :count="afterBatchCount"
        data-testid="after-batch"
      >
        <template #label>{{ $t('imageCompare.batchLabelB') }}</template>
      </BatchNavigation>
    </div>

    <div
      v-if="beforeImage || afterImage"
      ref="containerRef"
      data-testid="image-compare-viewport"
      class="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-node-component-surface py-4"
    >
      <img
        v-if="afterImage"
        :src="afterImage"
        :alt="afterAlt"
        draggable="false"
        class="absolute inset-0 size-full object-contain"
      />

      <img
        v-if="beforeImage"
        :src="beforeImage"
        :alt="beforeAlt"
        draggable="false"
        class="absolute inset-0 size-full object-contain"
        :style="
          hasCompareImages
            ? { clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }
            : undefined
        "
      />

      <!-- Circular drag handle -->
      <div
        v-if="hasCompareImages"
        class="pointer-events-none absolute top-1/2 z-10 size-6 -translate-1/2 rounded-full border-2 border-white bg-white/30 shadow-lg backdrop-blur-sm"
        :style="{ left: `${sliderPosition}%` }"
        role="presentation"
      />
    </div>

    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center"
      data-testid="image-compare-empty"
    >
      {{ $t('imageCompare.noImages') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMouseInElement } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import BatchNavigation from './BatchNavigation.vue'

export interface ImageCompareValue {
  beforeImages?: string[]
  afterImages?: string[]
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
const beforeIndex = ref(0)
const afterIndex = ref(0)

const { elementX, elementWidth, isOutside } = useMouseInElement(containerRef)

watch([elementX, elementWidth, isOutside], ([x, width, outside]) => {
  if (!outside && width > 0) {
    sliderPosition.value = Math.max(0, Math.min(100, (x / width) * 100))
  }
})

function isSingleImage(
  value: ImageCompareValue | string | undefined
): value is string {
  return typeof value === 'string'
}

const parsedValue = computed(() => {
  const value = props.widget.value
  return isSingleImage(value) ? null : value
})

const beforeBatchCount = computed(
  () => parsedValue.value?.beforeImages?.length ?? 0
)

const afterBatchCount = computed(
  () => parsedValue.value?.afterImages?.length ?? 0
)

const showBatchNav = computed(
  () => beforeBatchCount.value > 1 || afterBatchCount.value > 1
)

// Reset indices when batch data changes
watch(
  () => parsedValue.value?.beforeImages,
  () => {
    beforeIndex.value = 0
  }
)

watch(
  () => parsedValue.value?.afterImages,
  () => {
    afterIndex.value = 0
  }
)

const beforeImage = computed(() => {
  const value = props.widget.value
  if (isSingleImage(value)) return value
  return value?.beforeImages?.[beforeIndex.value] ?? ''
})

const afterImage = computed(() => {
  const value = props.widget.value
  if (isSingleImage(value)) return ''
  return value?.afterImages?.[afterIndex.value] ?? ''
})

const hasCompareImages = computed(() =>
  Boolean(beforeImage.value && afterImage.value)
)

const beforeAlt = computed(() => {
  const value = props.widget.value
  return !isSingleImage(value) && value?.beforeAlt
    ? value.beforeAlt
    : 'Before image'
})

const afterAlt = computed(() => {
  const value = props.widget.value
  return !isSingleImage(value) && value?.afterAlt
    ? value.afterAlt
    : 'After image'
})
</script>
