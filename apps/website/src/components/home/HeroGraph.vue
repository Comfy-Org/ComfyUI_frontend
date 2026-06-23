<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onMounted, ref } from 'vue'

import HeroGraphNode from './HeroGraphNode.vue'
import HeroHeadline from './HeroHeadline.vue'
import HeroImagePicker from './HeroImagePicker.vue'
import { imageVariants, textureImage } from './heroGraphData'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const activeId = ref<string>(imageVariants[0].id)
const activeVariant = computed(
  () => imageVariants.find((v) => v.id === activeId.value) ?? imageVariants[0]
)

// The desktop graph is authored in a fixed design coordinate space and scaled
// as a single unit to fit the viewport width, so node positions and wires
// never collide and the OUTPUT bleed is preserved on every screen.
const STAGE_W = 1600
const STAGE_H = 780
const MAX_SCALE = 1.3

interface Point {
  x: number
  y: number
}
interface Rect extends Point {
  w: number
  h: number
}

const frameRef = ref<HTMLElement>()
const stageRef = ref<HTMLElement>()
const scale = ref(1)
const anchors = ref<Record<string, Rect>>({})

// Measured from layout offsets (not getBoundingClientRect), so the values stay
// in unscaled design coordinates regardless of the stage's scale transform.
function measure() {
  const stage = stageRef.value
  if (!stage) return
  const next: Record<string, Rect> = {}
  stage.querySelectorAll<HTMLElement>('[data-node]').forEach((el) => {
    next[el.dataset.node ?? ''] = {
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight
    }
  })
  anchors.value = next
}

function updateScale() {
  const width = frameRef.value?.clientWidth ?? STAGE_W
  scale.value = Math.min(width / STAGE_W, MAX_SCALE)
}

function refresh() {
  updateScale()
  measure()
}

onMounted(() => void nextTick(refresh))
useResizeObserver(frameRef, refresh)

const stageStyle = computed(() => ({
  width: `${STAGE_W}px`,
  height: `${STAGE_H}px`,
  transform: `translateX(-50%) scale(${scale.value})`
}))

// Gentle cubic with tangents along the dominant axis. The control offset is
// capped so long runs stay soft and straight in the middle instead of swooping.
function spline(s: Point, e: Point): string {
  const dx = e.x - s.x
  const dy = e.y - s.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    const off = Math.sign(dx) * Math.min(Math.abs(dx) * 0.5, 90)
    return `M ${s.x} ${s.y} C ${s.x + off} ${s.y} ${e.x - off} ${e.y} ${e.x} ${e.y}`
  }
  const off = Math.sign(dy) * Math.min(Math.abs(dy) * 0.5, 90)
  return `M ${s.x} ${s.y} C ${s.x} ${s.y + off} ${e.x} ${e.y - off} ${e.x} ${e.y}`
}

interface Wire {
  d: string
  from: Point
  to: Point
  accent: boolean
}

const wires = computed<Wire[]>(() => {
  const a = anchors.value
  const { image, texture, color, lighting, output } = a
  const out: Wire[] = []
  const add = (from: Point, to: Point, accent = false) =>
    out.push({ from, to, accent, d: spline(from, to) })

  if (image && texture)
    add(
      { x: image.x + image.w * 0.4, y: image.y + image.h },
      { x: texture.x + texture.w * 0.5, y: texture.y },
      true
    )
  if (image && color)
    add(
      { x: image.x + image.w, y: image.y + image.h * 0.78 },
      { x: color.x, y: color.y + color.h * 0.5 }
    )
  if (color && lighting)
    add(
      { x: color.x + color.w, y: color.y + color.h * 0.5 },
      { x: lighting.x, y: lighting.y + lighting.h * 0.45 }
    )
  if (lighting && output)
    add(
      { x: lighting.x + lighting.w, y: lighting.y + lighting.h * 0.4 },
      { x: output.x, y: output.y + output.h * 0.4 }
    )
  return out
})

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

        <div class="absolute top-[150px] left-[680px] z-20 -translate-x-1/2">
          <HeroHeadline :locale />
        </div>

        <div data-node="image" class="absolute top-7 left-[60px] w-[300px]">
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
          class="absolute top-[500px] left-[96px] w-[200px]"
        >
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

        <div
          data-node="color"
          class="absolute top-[440px] left-[460px] w-[150px]"
        >
          <HeroGraphNode :label="t('hero.node.color', locale)">
            <div class="h-28 w-full rounded-lg"></div>
          </HeroGraphNode>
        </div>

        <div
          data-node="lighting"
          class="absolute top-[480px] left-[710px] w-[168px]"
        >
          <HeroGraphNode :label="t('hero.node.lighting', locale)">
            <div class="h-32 w-full rounded-lg"></div>
          </HeroGraphNode>
        </div>

        <div
          data-node="output"
          class="absolute top-[100px] left-[1000px] w-[760px]"
        >
          <HeroGraphNode :label="t('hero.node.output', locale)">
            <div class="relative h-[560px] w-full overflow-hidden rounded-xl">
              <Transition name="hero-glitch">
                <img
                  :key="activeVariant.output.src"
                  :src="activeVariant.output.src"
                  :alt="t(activeVariant.output.altKey, locale)"
                  data-testid="hero-output-image"
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
