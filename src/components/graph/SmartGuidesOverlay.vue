<template>
  <svg
    v-if="guides.length"
    data-testid="smart-guides"
    class="pointer-events-none absolute inset-0 z-1 size-full overflow-visible"
  >
    <template v-for="(guide, i) in guides" :key="i">
      <line
        v-if="guide.kind === 'line'"
        data-testid="smart-guide-line"
        class="stroke-primary"
        stroke-width="1"
        v-bind="lineEnds(guide)"
      />
      <line
        v-else-if="guide.kind === 'wire'"
        data-testid="smart-guide-wire"
        class="stroke-primary"
        stroke-width="3"
        stroke-linecap="round"
        v-bind="segment(guide.from, guide.to)"
      />
      <g v-else data-testid="smart-guide-gap" class="stroke-primary">
        <line stroke-width="1" v-bind="gapEnds(guide)" />
        <text
          class="fill-primary stroke-none text-2xs"
          text-anchor="middle"
          v-bind="gapLabelAt(guide)"
        >
          {{ Math.round(guide.to - guide.from) }}
        </text>
      </g>
    </template>
  </svg>
</template>

<script setup lang="ts">
import { shallowRef, watch } from 'vue'

import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { activeGuides } from '@/renderer/core/canvas/smartGuides/smartGuidesState'
import type { SmartGuide } from '@/renderer/core/canvas/smartGuides/snapSolver'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

type LineGuide = Extract<SmartGuide, { kind: 'line' }>
type GapGuide = Extract<SmartGuide, { kind: 'gap' }>

const canvasStore = useCanvasStore()
const { canvasToScreen, syncWithCanvas } = useTransformState()
const guides = shallowRef<readonly SmartGuide[]>([])

watch(
  () => canvasStore.canvas,
  (canvas, _, onCleanup) => {
    if (!canvas) return
    onCleanup(
      onCanvasFrame(canvas, 'present', () => {
        const next = activeGuides.value
        if (next === guides.value && !next.length) return
        guides.value = next
        syncWithCanvas(canvas)
      })
    )
  },
  { immediate: true }
)

function segment(from: Point2D, to: Point2D) {
  const start = canvasToScreen(from)
  const end = canvasToScreen(to)
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
}

function lineEnds({ axis, at, from, to }: LineGuide) {
  return axis === 'x'
    ? segment({ x: at, y: from }, { x: at, y: to })
    : segment({ x: from, y: at }, { x: to, y: at })
}

function gapEnds({ axis, from, to, cross }: GapGuide) {
  return axis === 'x'
    ? segment({ x: from, y: cross }, { x: to, y: cross })
    : segment({ x: cross, y: from }, { x: cross, y: to })
}

function gapLabelAt({ axis, from, to, cross }: GapGuide) {
  const mid = (from + to) / 2
  if (axis === 'x') {
    const { x, y } = canvasToScreen({ x: mid, y: cross })
    return { x, y: y - 4 }
  }
  const { x, y } = canvasToScreen({ x: cross, y: mid })
  return { x: x + 14, y: y + 4 }
}
</script>
