<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

import type {
  Light,
  RelightMask,
  RelightScene
} from '../../../lib/workshop/relight/lights'
import {
  fitImage,
  imageHeightMap,
  loadImage
} from '../../../lib/workshop/relight/render-image'
import type { RelightRenderer } from '../../../lib/workshop/relight/renderer'
import { createRelightRenderer } from '../../../lib/workshop/relight/renderer'
import { shadingUniforms } from '../../../lib/workshop/relight/shading'
import RelightPreview from './RelightPreview.vue'

const {
  url,
  lights,
  masks,
  scene,
  lightMap = false
} = defineProps<{
  url: string
  lights: readonly Light[]
  masks: readonly RelightMask[]
  scene: RelightScene
  lightMap?: boolean
}>()

const PREVIEW_EDGE = 2048

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const supported = ref(true)
let renderer: RelightRenderer | undefined
let ready = false
let frame = 0

function draw() {
  frame = 0
  const element = canvas.value
  if (!renderer || !element || !ready) return
  const box = element.getBoundingClientRect()
  const density = Math.min(window.devicePixelRatio || 1, 2)
  const fit = Math.min(
    1,
    PREVIEW_EDGE / (Math.max(box.width, box.height) * density || 1)
  )
  const width = Math.max(1, Math.round(box.width * density * fit))
  const height = Math.max(1, Math.round(box.height * density * fit))
  if (element.width !== width) element.width = width
  if (element.height !== height) element.height = height
  renderer.draw(shadingUniforms(lights, masks, scene), { lightMap })
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(draw)
}

async function load(source: string) {
  ready = false
  const image = await loadImage(source)
  const height = image && imageHeightMap(image)
  if (source !== url || !renderer) return
  if (!image || !height) {
    supported.value = false
    return
  }
  const fitted = fitImage(image, PREVIEW_EDGE)
  renderer.setImage(fitted.scale < 1 ? fitted.canvas : image, height)
  ready = true
  schedule()
}

onMounted(() => {
  renderer = canvas.value ? createRelightRenderer(canvas.value) : undefined
  if (renderer) void load(url)
  else supported.value = false
})

watch(() => url, load)
watch(() => [lights, masks, scene, lightMap], schedule)
useResizeObserver(canvas, schedule)

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  renderer?.dispose()
  renderer = undefined
})
</script>

<template>
  <canvas
    v-if="supported"
    ref="canvas"
    class="pointer-events-none absolute inset-0 size-full rounded-sm"
    data-testid="relight-preview"
    aria-hidden="true"
  />
  <RelightPreview v-else :lights :scene :light-map />
</template>
