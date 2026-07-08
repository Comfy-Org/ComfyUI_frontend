<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import HeroHeadline from './HeroHeadline.vue'
import HeroNodeWidgets from './HeroNodeWidgets.vue'
import HeroWorkflowNode from './HeroWorkflowNode.vue'
import HeroWorkflowOutput from './HeroWorkflowOutput.vue'
import {
  NODE_TITLE_KEYS,
  NODE_W,
  STAGE_H,
  STAGE_W,
  clampNodePosition,
  computeWires,
  homePositions,
  nodeWidgets
} from './heroWorkflowGraph'
import type {
  NodeWidget,
  Point,
  Rect,
  WorkflowNodeId
} from './heroWorkflowGraph'
import { useHeroWorkflowRun } from './useHeroWorkflowRun'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const run = useHeroWorkflowRun()
const { activeNode, nodeProgress, phase, seed, totalProgress } = run

const NODE_IDS: WorkflowNodeId[] = [
  'model',
  'clip',
  'vae',
  'lora',
  'seed',
  'output'
]

const percent = computed(() => Math.round(totalProgress.value * 100))

function widgetsFor(id: WorkflowNodeId): NodeWidget[] {
  if (id === 'seed') {
    return [
      { name: 'seed', value: String(seed.value), kind: 'number' },
      { name: 'control_after_generate', value: 'randomize', kind: 'combo' }
    ]
  }
  return nodeWidgets[id] ?? []
}

// The desktop graph is authored in a fixed design coordinate space and scaled
// as a single unit to fit the viewport width, so the whole composition stays on
// screen at every size. Node positions are live state so they can be dragged;
// widths are fixed per node and heights are measured once for wiring.
const MAX_SCALE = 1.3

const positions = ref<Record<WorkflowNodeId, Point>>(
  structuredClone(homePositions)
)

const frameRef = ref<HTMLElement>()
const stageRef = ref<HTMLElement>()
const scale = ref(1)
const heights = ref<Record<string, number>>({})

// Heights are read from layout offsets (not getBoundingClientRect) so they stay
// in unscaled design coordinates regardless of the stage's scale transform.
function measureHeights() {
  const stage = stageRef.value
  if (!stage) return
  const next: Record<string, number> = {}
  stage.querySelectorAll<HTMLElement>('[data-node]').forEach((el) => {
    next[el.dataset.node ?? ''] = el.offsetHeight
  })
  heights.value = next
}

function updateScale() {
  const width = frameRef.value?.clientWidth ?? STAGE_W
  scale.value = Math.min(width / STAGE_W, MAX_SCALE)
}

function refresh() {
  updateScale()
  measureHeights()
}

useResizeObserver(frameRef, refresh)

const stageStyle = computed(() => ({
  width: `${STAGE_W}px`,
  height: `${STAGE_H}px`,
  transform: `translateX(-50%) scale(${scale.value})`
}))

function nodeStyle(id: WorkflowNodeId) {
  const { x, y } = positions.value[id]
  return {
    transform: `translate3d(${x}px, ${y}px, 0)`,
    width: `${NODE_W[id]}px`
  }
}

// Wires recompute from live positions + measured heights, so they track the
// nodes synchronously while dragging with no measure round-trip.
const anchors = computed<Record<WorkflowNodeId, Rect>>(() => {
  const ids = Object.keys(positions.value) as WorkflowNodeId[]
  return Object.fromEntries(
    ids.map((id) => [
      id,
      { ...positions.value[id], w: NODE_W[id], h: heights.value[id] ?? 0 }
    ])
  ) as Record<WorkflowNodeId, Rect>
})

const dragging = ref<WorkflowNodeId | null>(null)
let drag = {
  id: '' as WorkflowNodeId,
  pointerId: -1,
  px: 0,
  py: 0,
  ox: 0,
  oy: 0
}

function onPointerDown(id: WorkflowNodeId, e: PointerEvent) {
  if (e.button !== 0) return
  drag = {
    id,
    pointerId: e.pointerId,
    px: e.clientX,
    py: e.clientY,
    ox: positions.value[id].x,
    oy: positions.value[id].y
  }
  dragging.value = id
}

// A small threshold keeps clicks on buttons from registering as drags.
function onPointerMove(e: PointerEvent) {
  if (dragging.value == null || e.pointerId !== drag.pointerId) return
  const dx = e.clientX - drag.px
  const dy = e.clientY - drag.py
  if (Math.hypot(dx, dy) < 4) return
  positions.value[drag.id] = clampNodePosition(
    drag.id,
    { x: drag.ox + dx / scale.value, y: drag.oy + dy / scale.value },
    heights.value[drag.id] ?? 0
  )
}

function onPointerUp() {
  dragging.value = null
}

// Listeners live on window so a drag continues even when the pointer outruns
// the node; registered in onMounted to keep window off the SSR path.
onMounted(() => {
  void nextTick(refresh)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

const wires = computed(() => computeWires(anchors.value))
</script>

<template>
  <div class="relative w-full">
    <!-- Execution progress pinned to the top of the hero, like the real app. -->
    <div
      v-if="phase === 'running'"
      class="absolute inset-x-0 top-0 z-40"
      data-testid="hero-total-progress"
    >
      <div class="h-1 bg-white/10">
        <div
          class="bg-hero-exec h-full transition-[width] duration-100 ease-linear"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <span class="absolute top-2.5 right-4 text-xs text-white/60 tabular-nums">
        {{ t('hero.totalProgress', locale) }}:
        <span class="font-semibold text-white">{{ percent }}%</span>
      </span>
    </div>

    <!-- Desktop / large screens: a fixed design stage scaled to fit the width -->
    <div
      ref="frameRef"
      class="relative hidden aspect-1600/780 max-h-[1000px] w-full lg:block"
    >
      <div
        ref="stageRef"
        data-testid="hero-stage"
        class="absolute top-0 left-1/2 origin-top"
        :style="stageStyle"
      >
        <svg
          class="pointer-events-none absolute inset-0 size-full overflow-visible"
          :viewBox="`0 0 ${STAGE_W} ${STAGE_H}`"
          fill="none"
          aria-hidden="true"
        >
          <path
            v-for="(wire, i) in wires"
            :key="i"
            :d="wire.d"
            :stroke="wire.color"
            stroke-opacity="0.5"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <template v-for="(wire, i) in wires" :key="`d${i}`">
            <circle
              :cx="wire.from.x"
              :cy="wire.from.y"
              r="3.5"
              :fill="wire.color"
            />
            <circle
              :cx="wire.to.x"
              :cy="wire.to.y"
              r="3.5"
              :fill="wire.color"
            />
          </template>
          <!-- Energy pulses that flow along every wire while the workflow runs;
               idle-hidden via opacity, animated through CSS. -->
          <g :class="cn(phase === 'running' && 'hero-wire-active')">
            <path
              v-for="(wire, i) in wires"
              :key="`p${i}`"
              :d="wire.d"
              class="hero-wire-pulse"
              :stroke="wire.color"
              stroke-width="2.5"
              stroke-linecap="round"
              pathLength="1"
              stroke-dasharray="0.18 0.82"
            />
          </g>
        </svg>

        <!-- The headline stays beneath the nodes so a dragged node passes
             cleanly over it instead of flipping layers mid-drag. -->
        <div class="absolute top-[90px] left-[720px] -translate-x-1/2">
          <HeroHeadline :locale />
        </div>

        <div
          v-for="id in NODE_IDS"
          :key="id"
          :data-node="id"
          :class="
            cn(
              'absolute top-0 left-0 cursor-grab touch-none will-change-transform select-none active:cursor-grabbing',
              dragging === id && 'z-30 cursor-grabbing'
            )
          "
          :style="nodeStyle(id)"
          @pointerdown="onPointerDown(id, $event)"
        >
          <HeroWorkflowNode
            :title="t(NODE_TITLE_KEYS[id], locale)"
            :state="run.nodeState(id)"
            :progress="activeNode === id ? nodeProgress : 0"
          >
            <HeroWorkflowOutput v-if="id === 'output'" :run :locale />
            <HeroNodeWidgets v-else :widgets="widgetsFor(id)" />
          </HeroWorkflowNode>
        </div>
      </div>
    </div>

    <!-- Mobile / tablet: the loaders condense into a compact grid feeding the
         Save Image node, so the whole workflow still fits one screen. -->
    <div class="flex flex-col items-center px-5 pt-6 pb-10 lg:hidden">
      <HeroHeadline :locale compact />

      <div class="mt-6 w-full max-w-sm sm:max-w-md">
        <div class="grid grid-cols-2 items-start gap-2">
          <HeroWorkflowNode
            v-for="id in ['model', 'clip', 'vae', 'lora'] as const"
            :key="id"
            :title="t(NODE_TITLE_KEYS[id], locale)"
            :state="run.nodeState(id)"
            :progress="activeNode === id ? nodeProgress : 0"
          >
            <HeroNodeWidgets :widgets="widgetsFor(id)" />
          </HeroWorkflowNode>
        </div>

        <HeroWorkflowNode
          class="mt-2"
          :title="t(NODE_TITLE_KEYS.seed, locale)"
          :state="run.nodeState('seed')"
          :progress="activeNode === 'seed' ? nodeProgress : 0"
        >
          <HeroNodeWidgets :widgets="widgetsFor('seed')" />
        </HeroWorkflowNode>

        <div class="relative h-6 w-full" aria-hidden="true">
          <svg
            class="absolute inset-0 size-full"
            viewBox="0 0 100 36"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M50 3 C 50 18 50 18 50 33"
              stroke="rgba(255,255,255,0.22)"
              stroke-width="1.5"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <span
            class="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-white/40"
          />
          <span
            class="bg-hero-exec absolute bottom-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
          />
        </div>

        <HeroWorkflowNode
          :title="t(NODE_TITLE_KEYS.output, locale)"
          :state="run.nodeState('output')"
          :progress="activeNode === 'output' ? nodeProgress : 0"
        >
          <HeroWorkflowOutput :run :locale />
        </HeroWorkflowNode>
      </div>
    </div>
  </div>
</template>
