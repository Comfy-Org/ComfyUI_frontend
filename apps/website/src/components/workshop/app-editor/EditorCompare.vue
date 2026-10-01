<script setup lang="ts">
import { ref } from 'vue'

import EditorChecker from './EditorChecker.vue'
import EditorFrame from './EditorFrame.vue'

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
      <span
        class="pointer-events-none absolute inset-y-0 w-px bg-primary-warm-white"
        :style="{ left: `${split}%` }"
        aria-hidden="true"
      />
      <span
        class="absolute top-2.5 left-2.5 rounded-full bg-primary-comfy-ink/75 px-2 py-0.5 text-[10px] text-primary-warm-white"
        >{{ beforeLabel }}</span
      >
      <span
        class="absolute top-2.5 right-2.5 rounded-full bg-primary-comfy-ink/75 px-2 py-0.5 text-[10px] text-primary-warm-white"
        >{{ afterLabel }}</span
      >
      <input
        v-model.number="split"
        type="range"
        min="0"
        max="100"
        :aria-label="sliderLabel"
        class="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  </EditorFrame>
</template>
