<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { computed, ref } from 'vue'

import { lightModes } from './useHeroControls'
import type { HeroControls } from './useHeroControls'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { controls, locale = 'en' } = defineProps<{
  controls: HeroControls
  locale?: Locale
}>()

const { lightModeId, lightIntensity, lightDir, setLightFromUnit } = controls

const intensityLabel = computed(
  () => `${t('hero.light.intensity', locale)} ${lightIntensity.value}%`
)

const dotStyle = computed(() => ({
  left: `${lightDir.value.x * 100}%`,
  top: `${lightDir.value.y * 100}%`
}))

const pad = ref<HTMLElement>()
const dragging = ref(false)

function applyFromEvent(e: PointerEvent) {
  const el = pad.value
  if (!el) return
  const r = el.getBoundingClientRect()
  setLightFromUnit(
    (e.clientX - r.left) / r.width,
    (e.clientY - r.top) / r.height
  )
}

function onDown(e: PointerEvent) {
  dragging.value = true
  pad.value?.setPointerCapture(e.pointerId)
  applyFromEvent(e)
}

function onMove(e: PointerEvent) {
  if (dragging.value) applyFromEvent(e)
}

function onUp(e: PointerEvent) {
  dragging.value = false
  pad.value?.releasePointerCapture?.(e.pointerId)
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div class="flex items-center gap-3">
      <div
        ref="pad"
        class="relative size-12 shrink-0 touch-none rounded-full bg-white/5 ring-1 ring-white/10 ring-inset"
        :aria-label="t('hero.light.direction', locale)"
        @pointerdown.stop.prevent="onDown"
        @pointermove.stop="onMove"
        @pointerup.stop="onUp"
        @pointercancel.stop="onUp"
      >
        <div
          class="hero-light-glow pointer-events-none absolute inset-0 rounded-full"
        />
        <div
          class="bg-primary-comfy-yellow pointer-events-none absolute size-3 -translate-1/2 rounded-full shadow-[0_0_10px_2px_rgb(242_255_89/0.6)]"
          :style="dotStyle"
        />
      </div>

      <label class="flex flex-1 flex-col gap-1">
        <span
          class="text-primary-warm-gray text-[0.6rem] font-medium tracking-wide uppercase"
        >
          {{ intensityLabel }}
        </span>
        <input
          v-model.number="lightIntensity"
          type="range"
          min="0"
          max="100"
          :aria-label="intensityLabel"
          class="accent-primary-comfy-yellow h-1 w-full cursor-pointer"
          @pointerdown.stop
          @click.stop
        />
      </label>
    </div>

    <div class="grid grid-cols-2 gap-1.5">
      <button
        v-for="m in lightModes"
        :key="m.id"
        type="button"
        :aria-pressed="m.id === lightModeId"
        :class="
          cn(
            'rounded-md px-1.5 py-1 text-[0.6rem] font-medium uppercase transition-colors',
            m.id === lightModeId
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'bg-white/5 text-primary-comfy-canvas hover:bg-white/10'
          )
        "
        @pointerdown.stop
        @click.stop="lightModeId = m.id"
      >
        {{ t(m.labelKey, locale) }}
      </button>
    </div>
  </div>
</template>
