<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'

import type { HTMLAttributes } from 'vue'

// Paints the first frame of an image, so animated thumbnails stay still.
const { src, alt = '' } = defineProps<{
  src: string
  alt?: string
  class?: HTMLAttributes['class']
}>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

onMounted(() => {
  const image = new Image()
  image.onload = () => {
    const target = canvas.value
    if (!target) return
    target.width = image.naturalWidth
    target.height = image.naturalHeight
    target.getContext('2d')?.drawImage(image, 0, 0)
  }
  image.src = src
})
</script>

<template>
  <canvas
    ref="canvas"
    :class="$props.class"
    :role="alt ? 'img' : undefined"
    :aria-label="alt || undefined"
    :aria-hidden="alt ? undefined : 'true'"
    data-testid="static-frame"
  />
</template>
