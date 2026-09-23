<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'

import type { GraphPicture } from '../../lib/hub/workflow-graph'
import { linkPath, readGraphPicture } from '../../lib/hub/workflow-graph'
import WorkflowGraphNode from './WorkflowGraphNode.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/hub'

const {
  source,
  samples = [],
  locale = 'en'
} = defineProps<{
  /** Where the template JSON is published. */
  source: string
  /** The template's own pictures: a before and an after, or just the after. */
  samples?: readonly string[]
  locale?: Locale
}>()

const picture = ref<GraphPicture>()
const failed = ref(false)

const frame = useTemplateRef<HTMLDivElement>('frame')
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)

onMounted(async () => {
  try {
    const response = await fetch(source)
    if (!response.ok) throw new Error(String(response.status))
    const drawn = readGraphPicture(await response.json(), samples)
    // Nothing to draw reads to the reader exactly as a refusal does.
    if (drawn.nodes.length === 0) throw new Error('empty')
    picture.value = drawn
  } catch {
    failed.value = true
  }
})

const transform = computed(
  () => `translate(${panX.value} ${panY.value}) scale(${scale.value})`
)

function zoomBy(factor: number) {
  scale.value = Math.min(3, Math.max(0.2, scale.value * factor))
}

function reset() {
  scale.value = 1
  panX.value = 0
  panY.value = 0
}

function onPointerDown(event: PointerEvent) {
  dragging.value = true
  frame.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  panX.value += event.movementX
  panY.value += event.movementY
}

function onPointerUp(event: PointerEvent) {
  dragging.value = false
  frame.value?.releasePointerCapture(event.pointerId)
}

const control =
  'inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-content-secondary transition-colors hover:bg-transparency-white-t8 hover:text-content-bright'
</script>

<template>
  <div
    ref="frame"
    class="relative h-112 touch-none overflow-hidden rounded-2xl bg-hub-surface select-none lg:h-128"
    :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
    data-testid="workflow-graph"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <svg
      v-if="picture"
      :viewBox="picture.viewBox"
      class="size-full"
      role="img"
      :aria-label="t('workshop.v2.workflow.graphAlt', locale)"
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

    <p
      v-else
      class="flex size-full items-center justify-center text-sm text-content-muted"
    >
      {{
        failed
          ? t('workshop.v2.workflow.graphFailed', locale)
          : t('workshop.v2.workflow.graphLoading', locale)
      }}
    </p>

    <span
      class="pointer-events-none absolute top-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-3xs/4 font-bold tracking-wider text-content-secondary uppercase backdrop-blur-md"
    >
      {{ t('workshop.v2.workflow.graphHint', locale) }}
    </span>

    <div
      v-if="picture"
      class="absolute right-3 bottom-3 flex items-center gap-1 rounded-xl bg-black/50 p-1 backdrop-blur-md"
    >
      <button type="button" :class="control" @click="zoomBy(1 / 1.2)">
        <span aria-hidden="true">&minus;</span>
        <span class="sr-only">{{
          t('workshop.v2.workflow.zoomOut', locale)
        }}</span>
      </button>
      <span class="px-1 font-mono text-2xs text-content-secondary tabular-nums">
        {{ Math.round(scale * 100) }}%
      </span>
      <button type="button" :class="control" @click="zoomBy(1.2)">
        <span aria-hidden="true">+</span>
        <span class="sr-only">{{
          t('workshop.v2.workflow.zoomIn', locale)
        }}</span>
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg px-2 text-2xs text-content-secondary transition-colors hover:text-content-bright"
        @click="reset"
      >
        {{ t('workshop.v2.workflow.zoomReset', locale) }}
      </button>
    </div>
  </div>
</template>
