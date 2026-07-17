<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed } from 'vue'

import { colorPresets, colorSwatches } from './useHeroControls'
import type { HeroControls } from './useHeroControls'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { controls, locale = 'en' } = defineProps<{
  controls: HeroControls
  locale?: Locale
}>()

const { colorPresetId, swatchId, colorIntensity } = controls

const remixLabel = computed(
  () => `${t('hero.color.remix', locale)} ${colorIntensity.value}%`
)
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div
      class="flex gap-1.5"
      role="group"
      :aria-label="t('hero.color.palette', locale)"
    >
      <button
        v-for="s in colorSwatches"
        :key="s.id"
        type="button"
        :aria-pressed="s.id === swatchId"
        :aria-label="t(s.labelKey, locale)"
        :style="{ backgroundColor: `rgb(${s.rgb})` }"
        :class="
          cn(
            'size-5 rounded-full ring-1 ring-white/20 transition-transform ring-inset',
            s.id === swatchId
              ? 'scale-110 ring-2 ring-white/80'
              : 'opacity-75 hover:opacity-100'
          )
        "
        @pointerdown.stop
        @click.stop="swatchId = s.id"
      />
    </div>

    <div class="grid grid-cols-2 gap-1.5">
      <button
        v-for="p in colorPresets"
        :key="p.id"
        type="button"
        :aria-pressed="p.id === colorPresetId"
        :class="
          cn(
            'rounded-md px-1.5 py-1 text-[0.6rem] font-medium uppercase transition-colors',
            p.id === colorPresetId
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'bg-white/5 text-primary-comfy-canvas hover:bg-white/10'
          )
        "
        @pointerdown.stop
        @click.stop="colorPresetId = p.id"
      >
        {{ t(p.labelKey, locale) }}
      </button>
    </div>

    <label class="flex flex-col gap-1">
      <span
        class="text-primary-warm-gray text-[0.6rem] font-medium tracking-wide uppercase"
      >
        {{ remixLabel }}
      </span>
      <input
        v-model.number="colorIntensity"
        type="range"
        min="0"
        max="100"
        :aria-label="remixLabel"
        class="accent-primary-comfy-yellow h-1 w-full cursor-pointer"
        @pointerdown.stop
        @click.stop
      />
    </label>
  </div>
</template>
