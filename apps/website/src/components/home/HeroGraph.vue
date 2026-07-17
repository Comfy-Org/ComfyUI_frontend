<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import HeroColorNode from './HeroColorNode.vue'
import HeroGraphNode from './HeroGraphNode.vue'
import HeroHeadline from './HeroHeadline.vue'
import HeroImagePicker from './HeroImagePicker.vue'
import HeroLightingNode from './HeroLightingNode.vue'
import HeroOutputFrame from './HeroOutputFrame.vue'
import { imageVariants, textureImage } from './heroGraphData'
import { computeWires } from './heroGraphWires'
import type { NodeId, Point, Rect } from './heroGraphWires'
import { useHeroControls } from './useHeroControls'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const controls = useHeroControls()
const { activeNode } = controls

const activeId = ref<string>(imageVariants[0].id)
const activeVariant = computed(
  () => imageVariants.find((v) => v.id === activeId.value) ?? imageVariants[0]
)

// The desktop graph is authored in a fixed design coordinate space and scaled
// as a single unit to fit the viewport width, so wires and the OUTPUT bleed are
// preserved on every screen. Node positions are live state so they can be
// dragged; widths are fixed per node and heights are measured once for wiring.
const STAGE_W = 1600
const STAGE_H = 780
const MAX_SCALE = 1.3

const NODE_W: Record<NodeId, number> = {
  image: 300,
  texture: 200,
  color: 210,
  lighting: 210,
  output: 760
}

// Whole graph is nudged left of the stage centre so the OUTPUT node bleeds less
// far off the right edge.
const positions = ref<Record<NodeId, Point>>({
  image: { x: 16, y: 28 },
  texture: { x: 52, y: 512 },
  color: { x: 404, y: 446 },
  lighting: { x: 662, y: 446 },
  output: { x: 956, y: 110 }
})

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

function nodeStyle(id: NodeId) {
  return {
    left: `${positions.value[id].x}px`,
    top: `${positions.value[id].y}px`,
    width: `${NODE_W[id]}px`
  }
}

// Wires recompute from live positions + measured heights, so they track the
// nodes synchronously while dragging with no measure round-trip.
const anchors = computed<Record<NodeId, Rect>>(() => {
  const ids = Object.keys(positions.value) as NodeId[]
  return Object.fromEntries(
    ids.map((id) => [
      id,
      { ...positions.value[id], w: NODE_W[id], h: heights.value[id] ?? 0 }
    ])
  ) as Record<NodeId, Rect>
})

const dragging = ref<NodeId | null>(null)
let drag = { id: '' as NodeId, pointerId: -1, px: 0, py: 0, ox: 0, oy: 0 }

function onPointerDown(id: NodeId, e: PointerEvent) {
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

// A small threshold keeps taps on the image picker from registering as drags.
function onPointerMove(e: PointerEvent) {
  if (dragging.value == null || e.pointerId !== drag.pointerId) return
  const dx = e.clientX - drag.px
  const dy = e.clientY - drag.py
  if (Math.hypot(dx, dy) < 4) return
  positions.value[drag.id] = {
    x: drag.ox + dx / scale.value,
    y: drag.oy + dy / scale.value
  }
}

function onPointerUp() {
  dragging.value = null
}

// Listeners live on window so a drag continues even when the pointer outruns the
// node; registered in onMounted to keep window off the SSR path.
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

const dots = computed<{ p: Point; accent: boolean }[]>(() =>
  wires.value.flatMap((w) => [
    { p: w.from, accent: w.accent },
    { p: w.to, accent: w.accent }
  ])
)
</script>

<template>
  <div class="relative w-full">
    <!-- Desktop / large screens: a fixed design stage scaled to fit the width -->
    <div
      ref="frameRef"
      class="relative hidden aspect-1600/780 max-h-[1000px] w-full lg:block"
    >
      <div
        ref="stageRef"
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
            :stroke="
              wire.accent
                ? 'var(--color-primary-comfy-yellow)'
                : 'rgba(255,255,255,0.16)'
            "
            :stroke-width="wire.accent ? 2 : 1.5"
            stroke-linecap="round"
          />
          <circle
            v-for="(dot, i) in dots"
            :key="`d${i}`"
            :cx="dot.p.x"
            :cy="dot.p.y"
            :r="dot.accent ? 4 : 3"
            :fill="
              dot.accent
                ? 'var(--color-primary-comfy-yellow)'
                : 'rgba(255,255,255,0.3)'
            "
          />
          <!-- Energy pulses that flow toward the OUTPUT while a control node is
               engaged; idle-hidden via opacity, animated through CSS. -->
          <g :class="cn(activeNode && 'hero-wire-active')">
            <path
              v-for="(wire, i) in wires"
              :key="`p${i}`"
              :d="wire.d"
              class="hero-wire-pulse"
              stroke="var(--color-primary-comfy-yellow)"
              stroke-width="2.5"
              stroke-linecap="round"
              pathLength="1"
              stroke-dasharray="0.18 0.82"
            />
          </g>
        </svg>

        <div class="absolute top-[150px] left-[636px] z-20 -translate-x-1/2">
          <HeroHeadline :locale />
        </div>

        <div
          data-node="image"
          :class="
            cn(
              'absolute cursor-grab touch-none select-none active:cursor-grabbing',
              dragging === 'image' && 'z-30 cursor-grabbing'
            )
          "
          :style="nodeStyle('image')"
          @pointerdown="onPointerDown('image', $event)"
        >
          <HeroGraphNode :label="t('hero.node.image', locale)" accent>
            <HeroImagePicker
              :variants="imageVariants"
              :active-id="activeId"
              :locale
              @select="(id) => (activeId = id)"
            />
          </HeroGraphNode>
        </div>

        <div
          data-node="texture"
          :class="
            cn(
              'absolute cursor-grab touch-none select-none active:cursor-grabbing',
              dragging === 'texture' && 'z-30 cursor-grabbing'
            )
          "
          :style="nodeStyle('texture')"
          @pointerdown="onPointerDown('texture', $event)"
        >
          <HeroGraphNode :label="t('hero.node.texture', locale)" accent>
            <div class="aspect-square w-full overflow-hidden rounded-xl">
              <img
                :src="textureImage.src"
                :alt="t(textureImage.altKey, locale)"
                draggable="false"
                class="size-full object-cover"
              />
            </div>
          </HeroGraphNode>
        </div>

        <div
          data-node="color"
          :class="
            cn(
              'absolute cursor-grab touch-none select-none active:cursor-grabbing',
              dragging === 'color' && 'z-30 cursor-grabbing'
            )
          "
          :style="nodeStyle('color')"
          @pointerdown="onPointerDown('color', $event)"
          @pointerenter="activeNode = 'color'"
          @pointerleave="activeNode = null"
        >
          <HeroGraphNode
            :label="t('hero.node.color', locale)"
            :active="activeNode === 'color'"
          >
            <HeroColorNode :controls :locale />
          </HeroGraphNode>
        </div>

        <div
          data-node="lighting"
          :class="
            cn(
              'absolute cursor-grab touch-none select-none active:cursor-grabbing',
              dragging === 'lighting' && 'z-30 cursor-grabbing'
            )
          "
          :style="nodeStyle('lighting')"
          @pointerdown="onPointerDown('lighting', $event)"
          @pointerenter="activeNode = 'lighting'"
          @pointerleave="activeNode = null"
        >
          <HeroGraphNode
            :label="t('hero.node.lighting', locale)"
            :active="activeNode === 'lighting'"
          >
            <HeroLightingNode :controls :locale />
          </HeroGraphNode>
        </div>

        <div
          data-node="output"
          :class="
            cn(
              'absolute cursor-grab touch-none select-none active:cursor-grabbing',
              dragging === 'output' && 'z-30 cursor-grabbing'
            )
          "
          :style="nodeStyle('output')"
          @pointerdown="onPointerDown('output', $event)"
        >
          <HeroGraphNode :label="t('hero.node.output', locale)">
            <HeroOutputFrame
              :controls
              :variant="activeVariant"
              :locale
              class="h-[560px]"
            />
          </HeroGraphNode>
        </div>
      </div>
    </div>

    <!-- Mobile / tablet: a compact connected graph that fits one screen — the
         IMAGE selector forks into COLOR + LIGHTING, which merge into the live
         OUTPUT. Connectors are decorative SVGs aligned to the 2-column grid. -->
    <div class="flex flex-col items-center px-5 pt-3 pb-8 lg:hidden">
      <HeroHeadline :locale compact />

      <div class="mt-3 w-full max-w-sm sm:max-w-md">
        <HeroGraphNode :label="t('hero.node.image', locale)" accent>
          <HeroImagePicker
            :variants="imageVariants"
            :active-id="activeId"
            :locale
            hide-preview
            thumb-class="h-14"
            @select="(id) => (activeId = id)"
          />
        </HeroGraphNode>

        <div class="relative h-6 w-full" aria-hidden="true">
          <svg
            class="absolute inset-0 size-full"
            viewBox="0 0 100 36"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M50 3 C 50 22 25 14 25 34"
              stroke="rgba(255,255,255,0.22)"
              stroke-width="1.5"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
            <path
              d="M50 3 C 50 22 75 14 75 34"
              stroke="rgba(255,255,255,0.22)"
              stroke-width="1.5"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <span
            class="bg-primary-comfy-yellow absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
          />
          <span
            class="absolute bottom-0 left-1/4 size-1.5 -translate-x-1/2 rounded-full bg-white/40"
          />
          <span
            class="absolute bottom-0 left-3/4 size-1.5 -translate-x-1/2 rounded-full bg-white/40"
          />
        </div>

        <div class="grid grid-cols-2 items-stretch gap-2">
          <HeroGraphNode :label="t('hero.node.color', locale)">
            <HeroColorNode :controls :locale />
          </HeroGraphNode>
          <HeroGraphNode :label="t('hero.node.lighting', locale)">
            <HeroLightingNode :controls :locale />
          </HeroGraphNode>
        </div>

        <div class="relative h-6 w-full" aria-hidden="true">
          <svg
            class="absolute inset-0 size-full"
            viewBox="0 0 100 36"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M25 2 C 25 18 50 14 50 33"
              stroke="rgba(255,255,255,0.22)"
              stroke-width="1.5"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
            <path
              d="M75 2 C 75 18 50 14 50 33"
              stroke="rgba(255,255,255,0.22)"
              stroke-width="1.5"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <span
            class="absolute top-0 left-1/4 size-1.5 -translate-x-1/2 rounded-full bg-white/40"
          />
          <span
            class="absolute top-0 left-3/4 size-1.5 -translate-x-1/2 rounded-full bg-white/40"
          />
          <span
            class="bg-primary-comfy-yellow absolute bottom-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
          />
        </div>

        <HeroGraphNode :label="t('hero.node.output', locale)" accent>
          <HeroOutputFrame
            :controls
            :variant="activeVariant"
            :locale
            class="h-[150px]"
          />
        </HeroGraphNode>
      </div>
    </div>
  </div>
</template>
