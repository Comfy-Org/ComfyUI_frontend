<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch
} from 'vue'

import type { Pose } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/camera'
import {
  focalPx,
  invertPose,
  orbitPose,
  sourceAim
} from '../../../../lib/workshop/cinematic-studio/reshoot-engine/camera'
import type { Geometry } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import { WarpRenderer } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/warp-renderer'

// The clip seen from the camera being aimed: the CrossView node's own warp,
// redrawn on the GPU from the depth the analysis returned, so a drag answers
// in the same frame. Magenta is what the source camera never saw. It is drawn
// at the output size, as the node draws the guide the model is given.
const { geometry, pose, hfov, keepAim, frame } = defineProps<{
  geometry: Geometry
  pose: Pose
  hfov: number
  keepAim: boolean
  /** 0-based, as the move controls count. */
  frame: number
}>()

const emit = defineEmits<{ unsupported: [] }>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const renderer = shallowRef<WarpRenderer>()
const bitmaps = shallowRef<ImageBitmap[]>([])
let loaded = -1

const index = () => Math.min(Math.max(frame, 0), geometry.frames - 1)
const output = () => ({
  w: geometry.sourceWidth || geometry.width,
  h: geometry.sourceHeight || geometry.height
})

function draw() {
  const r = renderer.value
  const i = index()
  const bitmap = bitmaps.value[i]
  if (!r || !bitmap) return
  if (loaded !== i) {
    r.setFrame(bitmap, geometry.depthHalf[i], geometry.depth[i])
    loaded = i
  }
  const { w, h } = output()
  const pivot = [pose.px, pose.py, pose.pz] as const
  const target = orbitPose(
    pose.az,
    pose.el,
    pose.dist,
    pivot,
    keepAim ? sourceAim(pivot) : undefined
  )
  r.render({
    inverseTarget: invertPose(target),
    fx: focalPx(w, hfov),
    sourceFx: focalPx(geometry.width, hfov),
    cx: w / 2,
    cy: h / 2 + pose.vs * h
  })
}

onMounted(async () => {
  if (!canvas.value) return
  try {
    const { w, h } = output()
    renderer.value = new WarpRenderer(
      canvas.value,
      geometry.width,
      geometry.height,
      w,
      h
    )
  } catch {
    emit('unsupported')
    return
  }
  bitmaps.value = await Promise.all(
    geometry.jpegs.map((jpeg) => createImageBitmap(jpeg))
  )
  draw()
})

onBeforeUnmount(() => {
  renderer.value?.dispose()
  for (const bitmap of bitmaps.value) bitmap.close()
})

watch(() => [pose, hfov, keepAim, frame], draw, { deep: true })
</script>

<template>
  <!-- Drawn at the analysis's preview size and scaled up to fill the frame,
       as the clip does before analysis; object-contain keeps its aspect. -->
  <canvas
    ref="canvas"
    class="absolute inset-0 size-full object-contain"
    data-testid="reshoot-warp"
  />
</template>
