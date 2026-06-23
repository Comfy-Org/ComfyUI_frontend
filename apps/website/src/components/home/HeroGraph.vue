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
// as a single unit to fit any width, so node positions and wires never collide
// and the OUTPUT bleed is preserved proportionally on every screen.
const STAGE_W = 1440
const STAGE_H = 760
const MAX_SCALE = 1.2

interface Rect {
  x: number
  y: number
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

function curve(
  from: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  to: { x: number; y: number }
): string {
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`
}

interface Wire {
  d: string
  accent: boolean
}

const wires = computed<Wire[]>(() => {
  const a = anchors.value
  const { image, texture, color, lighting, output } = a
  if (!image || !texture || !output) return []

  const result: Wire[] = []

  // Prominent yellow loop: out of the IMAGE node's left side, bowing down and
  // around into the bottom-left of the TEXTURE node.
  const imgLeft = { x: image.x, y: image.y + image.h * 0.55 }
  const texBottom = { x: texture.x + texture.w * 0.3, y: texture.y + texture.h }
  result.push({
    accent: true,
    d: curve(
      imgLeft,
      { x: imgLeft.x - 90, y: imgLeft.y + 90 },
      { x: texBottom.x - 150, y: texBottom.y + 70 },
      texBottom
    )
  })

  // Short yellow connector: IMAGE bottom into TEXTURE top.
  const imgBottom = { x: image.x + image.w * 0.4, y: image.y + image.h }
  const texTop = { x: texture.x + texture.w * 0.5, y: texture.y }
  result.push({
    accent: true,
    d: curve(
      imgBottom,
      { x: imgBottom.x, y: imgBottom.y + 60 },
      { x: texTop.x - 40, y: texTop.y - 60 },
      texTop
    )
  })

  // Faint wires fanning toward the placeholder nodes.
  if (color) {
    const colorLeft = { x: color.x, y: color.y + color.h * 0.5 }
    const imgRight = { x: image.x + image.w, y: image.y + image.h * 0.7 }
    result.push({
      accent: false,
      d: curve(
        imgRight,
        { x: imgRight.x + 70, y: imgRight.y + 30 },
        { x: colorLeft.x - 70, y: colorLeft.y + 20 },
        colorLeft
      )
    })
  }
  if (lighting) {
    const lightLeft = { x: lighting.x, y: lighting.y + lighting.h * 0.5 }
    const texRight = {
      x: texture.x + texture.w,
      y: texture.y + texture.h * 0.3
    }
    result.push({
      accent: false,
      d: curve(
        texRight,
        { x: texRight.x + 80, y: texRight.y - 40 },
        { x: lightLeft.x - 80, y: lightLeft.y + 40 },
        lightLeft
      )
    })
  }

  // Faint sweep from the center of the hero into the OUTPUT node's left edge.
  const center = { x: STAGE_W * 0.5, y: STAGE_H * 0.5 }
  const outLeft = { x: output.x, y: output.y + output.h * 0.32 }
  result.push({
    accent: false,
    d: curve(
      center,
      { x: center.x + 160, y: center.y - 40 },
      { x: outLeft.x - 160, y: outLeft.y + 20 },
      outLeft
    )
  })

  return result
})
</script>

<template>
  <div class="relative w-full">
    <!-- Desktop / large screens: a fixed design stage scaled to fit the width -->
    <div
      ref="frameRef"
      class="relative hidden aspect-1440/760 max-h-[912px] w-full lg:block"
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
        </svg>

        <div class="absolute top-[140px] left-1/2 z-20 -translate-x-1/2">
          <HeroHeadline :locale />
        </div>

        <div data-node="image" class="absolute top-6 left-[5%] w-[310px]">
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
          class="absolute top-[470px] left-[19%] w-[200px]"
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
          class="absolute top-[244px] left-[30%] w-[150px]"
        >
          <HeroGraphNode :label="t('hero.node.color', locale)">
            <div class="h-28 w-full rounded-lg"></div>
          </HeroGraphNode>
        </div>

        <div
          data-node="lighting"
          class="absolute top-[420px] left-[40%] w-[168px]"
        >
          <HeroGraphNode :label="t('hero.node.lighting', locale)">
            <div class="h-32 w-full rounded-lg"></div>
          </HeroGraphNode>
        </div>

        <div data-node="output" class="absolute top-24 left-[66%] w-[820px]">
          <HeroGraphNode :label="t('hero.node.output', locale)">
            <div class="relative h-[540px] w-full overflow-hidden rounded-xl">
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
