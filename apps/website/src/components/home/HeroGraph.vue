<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onMounted, ref } from 'vue'

import HeroGraphNode from './HeroGraphNode.vue'
import HeroImagePicker from './HeroImagePicker.vue'
import { imageVariants, textureImage } from './heroGraphData'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const activeId = ref<string>(imageVariants[0].id)
const activeVariant = computed(
  () => imageVariants.find((v) => v.id === activeId.value) ?? imageVariants[0]
)

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const stageRef = ref<HTMLElement>()
const stageSize = ref({ w: 0, h: 0 })
const anchors = ref<Record<string, Rect>>({})

function measure() {
  const stage = stageRef.value
  if (!stage) return
  const stageRect = stage.getBoundingClientRect()
  stageSize.value = { w: stageRect.width, h: stageRect.height }
  const next: Record<string, Rect> = {}
  stage.querySelectorAll<HTMLElement>('[data-node]').forEach((el) => {
    const r = el.getBoundingClientRect()
    next[el.dataset.node ?? ''] = {
      x: r.left - stageRect.left,
      y: r.top - stageRect.top,
      w: r.width,
      h: r.height
    }
  })
  anchors.value = next
}

onMounted(() => void nextTick(measure))
useResizeObserver(stageRef, measure)

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
  const center = { x: stageSize.value.w * 0.5, y: stageSize.value.h * 0.5 }
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
  <div class="relative size-full">
    <!-- Desktop: free-floating absolutely-positioned node graph -->
    <div ref="stageRef" class="absolute inset-0 hidden lg:block">
      <svg
        class="pointer-events-none absolute inset-0 size-full overflow-visible"
        :viewBox="`0 0 ${stageSize.w} ${stageSize.h}`"
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

      <div data-node="color" class="absolute top-[244px] left-[30%] w-[150px]">
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

    <!-- Mobile / tablet: nodes reflow into a stacked column below the headline -->
    <div class="flex flex-col gap-6 px-6 pb-14 lg:hidden">
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
</template>
