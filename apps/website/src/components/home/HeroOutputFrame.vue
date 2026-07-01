<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import type { ImageVariant } from './heroGraphData'
import type { HeroControls } from './useHeroControls'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  controls,
  variant,
  locale = 'en',
  class: customClass = ''
} = defineProps<{
  controls: HeroControls
  variant: ImageVariant
  locale?: Locale
  class?: HTMLAttributes['class']
}>()

const {
  activeNode,
  reducedMotion,
  pointer,
  outputFilter,
  colorLayerStyle,
  lightLayerStyle,
  lightMode
} = controls

const metaText = computed(
  () =>
    `${t('hero.output.grade', locale)} · ${t('hero.output.colorActive', locale)} · ${t(lightMode.value.labelKey, locale)} ${t('hero.output.lightingSuffix', locale)}`
)

function onMove(e: PointerEvent) {
  if (reducedMotion.value || e.pointerType !== 'mouse') return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = {
    x: (e.clientX - r.left) / r.width,
    y: (e.clientY - r.top) / r.height
  }
}

function onLeave() {
  pointer.value = null
}
</script>

<template>
  <div
    :class="
      cn(
        'relative w-full overflow-hidden rounded-xl transition-shadow duration-500',
        activeNode && 'hero-output-live',
        customClass
      )
    "
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <div class="relative size-full" :style="{ filter: outputFilter }">
      <Transition name="hero-glitch">
        <img
          :key="variant.output.src"
          :src="variant.output.src"
          :alt="t(variant.output.altKey, locale)"
          data-testid="hero-output-image"
          draggable="false"
          class="absolute inset-0 size-full object-cover"
        />
      </Transition>
    </div>

    <div
      class="pointer-events-none absolute inset-0 transition-opacity duration-500"
      :style="colorLayerStyle"
    />
    <div
      class="pointer-events-none absolute inset-0 mix-blend-screen transition-opacity duration-500"
      :style="lightLayerStyle"
    />
    <div
      v-if="activeNode"
      class="hero-output-sweep pointer-events-none absolute inset-0"
    />

    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-black/70 to-transparent px-3 pt-6 pb-2"
    >
      <span class="truncate font-mono text-[0.6rem] text-white/70">
        {{ metaText }}
      </span>
      <span class="flex shrink-0 items-center gap-1">
        <span
          class="hero-live-dot bg-primary-comfy-yellow size-1.5 rounded-full"
        />
        <span
          class="text-[0.6rem] font-medium tracking-wide whitespace-nowrap text-white/70 uppercase"
        >
          {{ t('hero.output.live', locale) }}
        </span>
      </span>
    </div>
  </div>
</template>
