<script setup lang="ts">
import EditorCompare from './EditorCompare.vue'
import EditorFrame from './EditorFrame.vue'
import type { EditorView } from './view'

const { before, after, view, width, height, labels } = defineProps<{
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
    />
    <EditorFrame v-else :width :height>
      <img
        :src="view === 'result' ? after : before"
        :alt="view === 'result' ? labels.resultAlt : labels.originalAlt"
        class="size-full rounded-sm object-cover"
      />
    </EditorFrame>
  </div>
</template>
