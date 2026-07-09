<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

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

const { outputFilter, colorLayerStyle, lightLayerStyle } = controls

const pill =
  'flex items-center gap-1.5 rounded-xl bg-primary-comfy-yellow px-3.5 py-2 text-xs leading-[1.1] font-bold tracking-[-0.01em] text-primary-comfy-ink uppercase'
</script>

<template>
  <div :class="cn('relative w-full overflow-hidden rounded-3xl', customClass)">
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
      class="pointer-events-none absolute top-4 left-4 flex flex-col items-start gap-2"
    >
      <span :class="pill">
        <span class="size-1.5 rounded-full bg-primary-comfy-ink" />
        {{ t('hero.output.pillColor', locale) }}
      </span>
      <span :class="pill">
        <span class="size-1.5 rounded-full bg-primary-comfy-ink" />
        {{ t('hero.output.pillLighting', locale) }}
      </span>
    </div>
  </div>
</template>
