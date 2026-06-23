<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import HeroGraphNode from './HeroGraphNode.vue'
import HeroHeadline from './HeroHeadline.vue'
import HeroImagePicker from './HeroImagePicker.vue'
import { imageVariants, textureImage } from './heroGraphData'
import { computeWires } from './heroGraphWires'
import type { NodeId, Point, Rect } from './heroGraphWires'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

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
  color: 150,
  lighting: 168,
  output: 760
}

// Whole graph is nudged left of the stage centre so the OUTPUT node bleeds less
// far off the right edge.
const positions = ref<Record<NodeId, Point>>({
  image: { x: 16, y: 28 },
  texture: { x: 52, y: 500 },
  color: { x: 426, y: 470 },
  lighting: { x: 676, y: 500 },
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
        >
          <HeroGraphNode :label="t('hero.node.color', locale)">
            <div class="h-28 w-full rounded-lg"></div>
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
        >
          <HeroGraphNode :label="t('hero.node.lighting', locale)">
            <div class="h-32 w-full rounded-lg"></div>
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
            <div class="relative h-[560px] w-full overflow-hidden rounded-xl">
              <Transition name="hero-glitch">
                <img
                  :key="activeVariant.output.src"
                  :src="activeVariant.output.src"
                  :alt="t(activeVariant.output.altKey, locale)"
                  data-testid="hero-output-image"
                  draggable="false"
                  class="absolute inset-0 size-full object-cover"
                />
              </Transition>
            </div>
          </HeroGraphNode>
        </div>
      </div>
    </div>

    <!-- Mobile / tablet: headline + nodes reflow into a centered column -->
    <div class="flex flex-col items-center px-6 py-12 lg:hidden">
      <HeroHeadline :locale compact />

      <div class="mt-10 flex w-full max-w-sm flex-col gap-6 md:max-w-md">
        <HeroGraphNode :label="t('hero.node.image', locale)" accent>
          <HeroImagePicker
            :variants="imageVariants"
            :active-id="activeId"
            :locale
            @select="(id) => (activeId = id)"
          />
        </HeroGraphNode>

        <HeroGraphNode :label="t('hero.node.output', locale)">
          <div class="relative aspect-square w-full overflow-hidden rounded-xl">
            <Transition name="hero-glitch">
              <img
                :key="activeVariant.output.src"
                :src="activeVariant.output.src"
                :alt="t(activeVariant.output.altKey, locale)"
                class="absolute inset-0 size-full object-cover"
              />
            </Transition>
          </div>
        </HeroGraphNode>

        <HeroGraphNode :label="t('hero.node.texture', locale)" accent>
          <div class="aspect-square w-full overflow-hidden rounded-xl">
            <img
              :src="textureImage.src"
              :alt="t(textureImage.altKey, locale)"
              class="size-full object-cover"
            />
          </div>
        </HeroGraphNode>
      </div>
    </div>
  </div>
</template>
