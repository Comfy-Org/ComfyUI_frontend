<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
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
  checker = false,
  locale = 'en'
} = defineProps<{
  before: string
  after: string
  alt: string
  /** "Before" unless the app names it. */
  beforeLabel?: string
  /** "After" unless the app names it. */
  afterLabel?: string
  sliderLabel: string
  width: number
  height: number
  /** Shows a checkerboard through the result's transparent pixels. */
  checker?: boolean
  locale?: Locale
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
        :before-label="beforeLabel ?? tc('cinematic.compare.before', locale)"
        :after-label="afterLabel ?? tc('cinematic.compare.after', locale)"
        :slider-label="sliderLabel"
      />
    </div>
  </EditorFrame>
</template>
