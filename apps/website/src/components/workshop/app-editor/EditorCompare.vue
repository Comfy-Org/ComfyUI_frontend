<script setup lang="ts">
import { ref } from 'vue'

import EditorChecker from './EditorChecker.vue'
import EditorFrame from './EditorFrame.vue'
import EditorSplitLine from './EditorSplitLine.vue'

const {
  before,
  after,
  alt,
  beforeLabel,
  afterLabel,
  sliderLabel,
  width,
  height,
  checker = false
} = defineProps<{
  before: string
  after: string
  alt: string
  beforeLabel: string
  afterLabel: string
  sliderLabel: string
  width: number
  height: number
  /** Shows a checkerboard through the result's transparent pixels. */
  checker?: boolean
}>()

const split = ref(50)
</script>

<template>
  <EditorFrame :width :height>
    <div class="relative size-full overflow-hidden rounded-sm">
      <EditorChecker v-if="checker" />
      <img :src="after" :alt class="absolute inset-0 size-full object-cover" />
      <img
        :src="before"
        alt=""
        class="absolute inset-0 size-full object-cover"
        :style="{ clipPath: `inset(0 ${100 - split}% 0 0)` }"
      />
      <EditorSplitLine
        v-model="split"
        :before-label="beforeLabel"
        :after-label="afterLabel"
        :slider-label="sliderLabel"
      />
    </div>
  </EditorFrame>
</template>
