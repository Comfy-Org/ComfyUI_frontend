<template>
  <div ref="containerRef" class="w-full">
    <!-- Hidden single-line measurement element for overflow detection -->
    <div
      ref="measureRef"
      class="pointer-events-none invisible absolute inset-x-0 top-0 overflow-hidden whitespace-nowrap"
      aria-hidden="true"
      v-text="text"
    />
    <div class="flex w-full flex-col">
      <MarqueeLine v-for="(line, index) in lines" :key="index">
        {{ line }}
      </MarqueeLine>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import MarqueeLine from './MarqueeLine.vue'
import { splitTextAtWordBoundary } from '@/utils/textTickerUtils'

const { text } = defineProps<{ text: string }>()

const measureRef = useTemplateRef('measureRef')
const containerRef = useTemplateRef('containerRef')
const { width: textWidth } = useElementSize(measureRef)
const { width: containerWidth } = useElementSize(containerRef)

const lines = computed(() => {
  if (!textWidth.value || !containerWidth.value) return [text]

  const safeRenderWidth = containerWidth.value - 30
  if (textWidth.value <= safeRenderWidth) return [text]

  return splitTextAtWordBoundary(text, safeRenderWidth / textWidth.value)
})
</script>
