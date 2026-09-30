<script setup lang="ts">
import { Maximize2 } from '@lucide/vue'
import { useMounted } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { GraphPicture } from '../../lib/workshop/workflow-graph'
import { linkPath, readGraphPicture } from '../../lib/workshop/workflow-graph'
import { openingView } from '../../lib/workshop/workflow-graph-view'
import { t } from '../../i18n/translations'
import WorkflowGraphControls from './WorkflowGraphControls.vue'
import WorkflowGraphNode from './WorkflowGraphNode.vue'

const {
  source,
  samples = [],
  fallback,
  fullHref,
  active = true
} = defineProps<{
  /** Where the template JSON is published. */
  source: string
  /** The template's own pictures: a before and an after, or just the after. */
  samples?: readonly string[]
  /** The flat export, for when the JSON cannot be read. */
  fallback?: string
  /** The flat export opened at full size, from the panel's own corner. */
  fullHref?: string
  /** Whether the graph is on screen; it is not fetched until it first is. */
  active?: boolean
}>()

const picture = ref<GraphPicture>()
const failed = ref(false)

const statusText = computed(() =>
  failed.value
    ? t('workshop.workflow.graphFailed')
    : t('workshop.workflow.graphLoading')
)

const frame = useTemplateRef<HTMLDivElement>('frame')
const canvas = useTemplateRef<SVGSVGElement>('canvas')
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)

const mounted = useMounted()
watch(
  () => mounted.value && active,
  (visible) => {
    if (!visible) return
    void load()
  },
  { once: true }
)

async function load() {
  try {
    const response = await fetch(source)
    if (!response.ok) throw new Error(String(response.status))
    const drawn = readGraphPicture(await response.json(), samples)
    // Nothing to draw reads to the reader exactly as a refusal does.
    if (drawn.nodes.length === 0) throw new Error('empty')
    picture.value = drawn
    applyOpeningView(drawn)
  } catch {
    failed.value = true
  }
}

// Zoom about the middle of the drawing: published graphs sit thousands of
// units from the origin, so scaling about (0, 0) would carry them off-screen.
const transform = computed(() => {
  if (!picture.value) return undefined
  const [x, y, width, height] = picture.value.viewBox.split(' ').map(Number)
  const cx = x + width / 2
  const cy = y + height / 2
  return `translate(${panX.value} ${panY.value}) translate(${cx} ${cy}) scale(${scale.value}) translate(${-cx} ${-cy})`
})

function zoomBy(factor: number) {
  scale.value = Math.min(3, Math.max(0.2, scale.value * factor))
}

function reset() {
  if (picture.value) return applyOpeningView(picture.value)
  scale.value = 1
  panX.value = 0
  panY.value = 0
}

function applyOpeningView(drawn: GraphPicture) {
  const view = openingView(
    drawn,
    frame.value?.clientWidth ?? 0,
    frame.value?.clientHeight ?? 0
  )
  scale.value = view.scale
  panX.value = view.panX
  panY.value = view.panY
}

function onPointerDown(event: PointerEvent) {
  // Capturing a press on a control would retarget its click to the frame, so
  // the zoom buttons and the link out to the full-size export never fire.
  if ((event.target as Element).closest('button, a')) return
  dragging.value = true
  frame.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  // The pan is in drawing units; the pointer moves in screen pixels.
  const pixelsPerUnit = canvas.value?.getScreenCTM()?.a || 1
  panX.value += event.movementX / pixelsPerUnit
  panY.value += event.movementY / pixelsPerUnit
}

function onPointerUp(event: PointerEvent) {
  dragging.value = false
  frame.value?.releasePointerCapture(event.pointerId)
}
</script>

<template>
  <div
    ref="frame"
    class="relative h-112 touch-pan-y overflow-hidden rounded-2xl bg-hub-surface select-none lg:h-128"
    :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
    data-testid="workflow-graph"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <svg
      v-if="picture"
      ref="canvas"
      :viewBox="picture.viewBox"
      class="size-full"
      role="img"
      :aria-label="t('workshop.workflow.graphAlt')"
      preserveAspectRatio="xMidYMid meet"
    >
      <g :transform="transform">
        <!-- Whoever built the graph framed and named parts of it, and that
          framing is most of what makes it readable on the canvas. -->
        <g v-for="group in picture.groups" :key="group.id">
          <rect
            :x="group.x"
            :y="group.y"
            :width="group.width"
            :height="group.height"
            rx="12"
            :fill="group.color"
            fill-opacity="0.16"
            :stroke="group.color"
            stroke-opacity="0.5"
          />
          <text
            :x="group.x + 14"
            :y="group.y + 22"
            :fill="group.color"
            font-size="14"
            font-weight="600"
          >
            {{ group.title }}
          </text>
        </g>

        <path
          v-for="link in picture.links"
          :key="link.id"
          :d="linkPath(link)"
          fill="none"
          :stroke="link.color"
          stroke-width="2.5"
          stroke-opacity="0.65"
        />
        <WorkflowGraphNode v-for="node in picture.nodes" :key="node.id" :node />
      </g>
    </svg>

    <!-- The flat export is what this page showed before, so a graph that
      cannot be read falls back to it rather than to nothing. -->
    <img
      v-else-if="failed && fallback"
      :src="fallback"
      :alt="t('workshop.workflow.graphAlt')"
      loading="lazy"
      class="size-full object-contain"
      data-testid="workflow-graph-flat"
    />

    <p
      v-else
      class="flex size-full items-center justify-center text-sm text-content-muted"
    >
      {{ statusText }}
    </p>

    <a
      v-if="fullHref"
      :href="fullHref"
      target="_blank"
      rel="noopener"
      class="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-xl bg-black/50 text-content-secondary backdrop-blur-md transition-colors hover:text-content-bright focus-visible:text-content-bright focus-visible:outline-primary-comfy-yellow"
      data-testid="workflow-graph-full"
    >
      <Maximize2 class="size-4" aria-hidden="true" />
      <span class="sr-only">{{ t('workshop.workflow.fullPreview') }}</span>
    </a>

    <WorkflowGraphControls
      v-if="picture"
      :scale
      @zoom="zoomBy"
      @reset="reset"
    />
  </div>
</template>
