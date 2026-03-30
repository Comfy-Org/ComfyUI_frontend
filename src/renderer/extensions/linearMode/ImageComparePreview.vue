<script setup lang="ts">
import { useMouseInElement } from '@vueuse/core'
import { computed, ref, watchEffect } from 'vue'

import BatchNavigation from '@/renderer/extensions/vueNodes/widgets/components/BatchNavigation.vue'
import type { CompareImages } from '@/stores/queueStore'

const { compareImages } = defineProps<{
  compareImages: CompareImages
}>()

const containerRef = ref<HTMLElement | null>(null)
const sliderPosition = ref(50)
const beforeIndex = ref(0)
const afterIndex = ref(0)
const imageAspect = ref('')

function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) {
    imageAspect.value = `${img.naturalWidth} / ${img.naturalHeight}`
  }
}

const { elementX, elementWidth } = useMouseInElement(containerRef)

watchEffect(() => {
  const x = elementX.value
  const width = elementWidth.value
  if (width > 0) {
    sliderPosition.value = Math.max(0, Math.min(100, (x / width) * 100))
  }
})

const beforeCount = computed(() => compareImages.before.length)
const afterCount = computed(() => compareImages.after.length)

const showBatchNav = computed(
  () => beforeCount.value > 1 || afterCount.value > 1
)

const beforeUrl = computed(() => {
  const idx = Math.min(beforeIndex.value, beforeCount.value - 1)
  return compareImages.before[Math.max(0, idx)]?.url ?? ''
})

const afterUrl = computed(() => {
  const idx = Math.min(afterIndex.value, afterCount.value - 1)
  return compareImages.after[Math.max(0, idx)]?.url ?? ''
})

const hasCompareImages = computed(() =>
  Boolean(beforeUrl.value && afterUrl.value)
)
</script>

<template>
  <div class="flex size-full flex-col overflow-hidden">
    <div
      v-if="showBatchNav"
      class="flex shrink-0 justify-between px-2 py-1 text-xs"
      data-testid="batch-nav"
    >
      <BatchNavigation
        v-model="beforeIndex"
        :count="beforeCount"
        data-testid="before-batch"
      >
        <template #label>{{ $t('imageCompare.batchLabelA') }}</template>
      </BatchNavigation>
      <div v-if="beforeCount <= 1" />

      <BatchNavigation
        v-model="afterIndex"
        :count="afterCount"
        data-testid="after-batch"
      >
        <template #label>{{ $t('imageCompare.batchLabelB') }}</template>
      </BatchNavigation>
    </div>

    <div
      v-if="beforeUrl || afterUrl"
      class="flex min-h-0 flex-1 items-center justify-center"
    >
      <div
        ref="containerRef"
        class="relative h-full max-w-full cursor-col-resize"
        :style="imageAspect ? { aspectRatio: imageAspect } : undefined"
      >
        <img
          :src="afterUrl || beforeUrl"
          :alt="
            afterUrl
              ? $t('imageCompare.altAfter')
              : $t('imageCompare.altBefore')
          "
          draggable="false"
          class="block size-full"
          @load="onImageLoad"
        />

        <img
          v-if="hasCompareImages"
          :src="beforeUrl"
          :alt="$t('imageCompare.altBefore')"
          draggable="false"
          class="absolute inset-0 size-full object-cover"
          :style="{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }"
        />

        <div
          v-if="hasCompareImages"
          class="pointer-events-none absolute top-0 z-10 h-full w-0.5 -translate-x-1/2 bg-white/80"
          :style="{ left: `${sliderPosition}%` }"
          role="presentation"
        />
        <div
          v-if="hasCompareImages"
          class="pointer-events-none absolute top-1/2 z-10 size-6 -translate-1/2 rounded-full border-2 border-white bg-white/30 shadow-lg backdrop-blur-sm"
          :style="{ left: `${sliderPosition}%` }"
          role="presentation"
        />
      </div>
    </div>

    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center text-muted-foreground"
    >
      {{ $t('imageCompare.noImages') }}
    </div>
  </div>
</template>
