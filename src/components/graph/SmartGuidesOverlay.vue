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
        :x1="toScreenX(guide.from.x)"
        :y1="toScreenY(guide.from.y)"
        :x2="toScreenX(guide.to.x)"
        :y2="toScreenY(guide.to.y)"
      />
      <g v-else data-testid="smart-guide-gap" class="stroke-primary">
        <line stroke-width="1" v-bind="gapEnds(guide)" />
        <text
          class="fill-primary stroke-none text-[11px]"
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
import { ref, watch } from 'vue'

import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { activeGuides } from '@/renderer/core/canvas/smartGuides/smartGuidesState'
import type { SmartGuide } from '@/renderer/core/canvas/smartGuides/snapSolver'
import { useSmartGuidesSettings } from '@/renderer/core/canvas/smartGuides/useSmartGuidesSettings'

type LineGuide = Extract<SmartGuide, { kind: 'line' }>
type GapGuide = Extract<SmartGuide, { kind: 'gap' }>

useSmartGuidesSettings()

const canvasStore = useCanvasStore()
const guides = ref<readonly SmartGuide[]>([])
const camera = ref({ x: 0, y: 0, scale: 1 })

watch(
  () => canvasStore.canvas,
  (canvas, _, onCleanup) => {
    if (!canvas) return
    onCleanup(
      onCanvasFrame(canvas, 'present', () => {
        const [x, y] = canvas.ds.offset
        const { scale } = canvas.ds
        const next = activeGuides.value
        if (next === guides.value && !next.length) return
        guides.value = next
        if (
          camera.value.x !== x ||
          camera.value.y !== y ||
          camera.value.scale !== scale
        )
          camera.value = { x, y, scale }
      })
    )
  },
  { immediate: true }
)

function toScreenX(x: number) {
  return (x + camera.value.x) * camera.value.scale
}

function toScreenY(y: number) {
  return (y + camera.value.y) * camera.value.scale
}

function lineEnds({ axis, at, from, to }: LineGuide) {
  return axis === 'x'
    ? {
        x1: toScreenX(at),
        x2: toScreenX(at),
        y1: toScreenY(from),
        y2: toScreenY(to)
      }
    : {
        x1: toScreenX(from),
        x2: toScreenX(to),
        y1: toScreenY(at),
        y2: toScreenY(at)
      }
}

function gapEnds({ axis, from, to, cross }: GapGuide) {
  return axis === 'x'
    ? {
        x1: toScreenX(from),
        x2: toScreenX(to),
        y1: toScreenY(cross),
        y2: toScreenY(cross)
      }
    : {
        x1: toScreenX(cross),
        x2: toScreenX(cross),
        y1: toScreenY(from),
        y2: toScreenY(to)
      }
}

function gapLabelAt({ axis, from, to, cross }: GapGuide) {
  const mid = (from + to) / 2
  return axis === 'x'
    ? { x: toScreenX(mid), y: toScreenY(cross) - 4 }
    : { x: toScreenX(cross) + 14, y: toScreenY(mid) + 4 }
}
</script>
