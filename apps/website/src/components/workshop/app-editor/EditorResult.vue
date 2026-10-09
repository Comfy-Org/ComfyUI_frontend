<script setup lang="ts">
import EditorChecker from './EditorChecker.vue'
import EditorCompare from './EditorCompare.vue'
import EditorFrame from './EditorFrame.vue'
import type { EditorView } from './view'

const {
  before,
  after,
  view,
  width,
  height,
  labels,
  checker = false
} = defineProps<{
  before: string
  after: string
  view: EditorView
  width: number
  height: number
  labels: {
    resultAlt: string
    originalAlt: string
    original: string
    result: string
    slider: string
  }
  /** Shows a checkerboard through the result's transparent pixels. */
  checker?: boolean
}>()
</script>

<template>
  <div class="size-full max-w-5xl">
    <EditorCompare
      v-if="view === 'compare'"
      :before
      :after
      :alt="labels.resultAlt"
      :before-label="labels.original"
      :after-label="labels.result"
      :slider-label="labels.slider"
      :width
      :height
      :checker
    />
    <EditorFrame v-else :width :height>
      <EditorChecker v-if="checker && view === 'result'" />
      <img
        :src="view === 'result' ? after : before"
        :alt="view === 'result' ? labels.resultAlt : labels.originalAlt"
        class="relative size-full rounded-sm object-cover"
      />
    </EditorFrame>
  </div>
</template>
