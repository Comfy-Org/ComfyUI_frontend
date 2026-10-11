<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'

import type { HTMLAttributes } from 'vue'

// Paints the first frame of an image, so animated thumbnails stay still.
const { src, alt = '' } = defineProps<{
  src: string
  alt?: string
  class?: HTMLAttributes['class']
}>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

watch(
  [() => src, canvas],
  ([source, target], _, onCleanup) => {
    if (!target) return
    const clear = () => {
      target.width = 0
      target.height = 0
    }
    clear()
    const image = new Image()
    image.onload = () => {
      target.width = image.naturalWidth
      target.height = image.naturalHeight
      target.getContext('2d')?.drawImage(image, 0, 0)
    }
    image.onerror = clear
    image.src = source
    onCleanup(() => {
      image.onload = null
      image.onerror = null
    })
  },
  { immediate: true, flush: 'post' }
)
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
