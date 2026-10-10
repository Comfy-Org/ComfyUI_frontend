<template>
  <div class="flex size-full min-h-32 flex-col overflow-hidden">
    <div
      v-if="showBatchNav"
      class="flex shrink-0 justify-between px-2 py-1 text-xs"
      data-testid="batch-nav"
    >
      <BatchNavigation
        v-model="beforeIndex"
        :count="beforeImages.length"
        data-testid="before-batch"
      >
        <template #label>{{ $t('imageCompare.batchLabelA') }}</template>
      </BatchNavigation>
      <div v-if="beforeImages.length <= 1" />

      <BatchNavigation
        v-model="afterIndex"
        :count="afterImages.length"
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
        :alt="$t('imageCompare.afterAlt')"
        draggable="false"
        class="absolute inset-0 size-full object-contain"
      />

      <img
        v-if="beforeImage"
        :src="beforeImage"
        :alt="$t('imageCompare.beforeAlt')"
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
        class="pointer-events-none absolute top-0 z-10 h-full w-6"
        :style="{ left: `${sliderPosition}%` }"
        role="presentation"
      >
        <div
          class="absolute top-0 h-[calc(50%-var(--spacing)*3)] w-0.25 bg-white/30 backdrop-blur-sm"
        />
        <div
          class="absolute top-1/2 size-6 -translate-1/2 rounded-full border-2 bg-white/30 shadow-lg backdrop-blur-sm"
        />
        <div
          class="absolute bottom-0 h-[calc(50%-var(--spacing)*3)] w-0.25 bg-white/30 backdrop-blur-sm"
        />
      </div>
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

import { useImageCompareImages } from '@/renderer/extensions/vueNodes/widgets/composables/useImageCompareImages'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

import BatchNavigation from './BatchNavigation.vue'

const { widget, nodeId } = defineProps<{
  widget: SimplifiedWidget<string[]>
  nodeId: NodeId
}>()

const node = computed(() => {
  const locatorId = widget.nodeLocatorId
  const owner = locatorId && getNodeByLocatorId(app.rootGraph, locatorId)
  return owner || app.canvas.graph?.getNodeById(nodeId)
})

const { beforeImages, afterImages } = useImageCompareImages(node)

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

const showBatchNav = computed(
  () => beforeImages.value.length > 1 || afterImages.value.length > 1
)

watch(beforeImages, (images) => {
  if (beforeIndex.value >= images.length) beforeIndex.value = 0
})

watch(afterImages, (images) => {
  if (afterIndex.value >= images.length) afterIndex.value = 0
})

const beforeImage = computed(() => beforeImages.value[beforeIndex.value] ?? '')
const afterImage = computed(() => afterImages.value[afterIndex.value] ?? '')

const hasCompareImages = computed(() =>
  Boolean(beforeImage.value && afterImage.value)
)
</script>
