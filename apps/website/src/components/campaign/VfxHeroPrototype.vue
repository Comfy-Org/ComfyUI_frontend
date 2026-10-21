<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { prefersReducedMotion } from '@/composables/useReducedMotion'
import ProductHeroBadge from '@/components/common/ProductHeroBadge.vue'
import HeroSplit01 from '@/components/blocks/HeroSplit01.vue'
import VfxSampleScene from '@/components/campaign/VfxSampleScene.vue'
import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
import '@/styles/workflow-canvas.css'
import '@/styles/vfx-connected.css'
import '@/styles/vfx-hero-prototype.css'

const { locale, contactHref, source, variants } = defineProps<{
  locale: Locale
  contactHref: string
  source: string
  variants: { id: string; label: string }[]
}>()
const { t } = translationsFor(locale)
const selected = ref<string>(variants[0].id)
const time = ref(0)
const paused = ref(false)
const playbackIntent = ref<'auto' | 'play' | 'pause'>('auto')
function togglePlayback() {
  paused.value = !paused.value
  playbackIntent.value = paused.value ? 'pause' : 'play'
}
watch(
  () => prefersReducedMotion(),
  (reduce) => {
    if (reduce) {
      if (playbackIntent.value === 'play') playbackIntent.value = 'auto'
      paused.value = true
    } else if (playbackIntent.value === 'auto') paused.value = false
  }
)
const assembled = ref(false)
const settled = ref(false)
let assemblyTimer: ReturnType<typeof setTimeout> | undefined
const root = useTemplateRef<HTMLElement>('root')
useIntersectionObserver(
  root,
  ([entry]) => {
    if (entry?.isIntersecting && !assembled.value) {
      assembled.value = true
      assemblyTimer = setTimeout(() => {
        settled.value = true
      }, 1100)
    }
  },
  { threshold: 0.2 }
)
onMounted(() => {
  paused.value = prefersReducedMotion()
})
onUnmounted(() => clearTimeout(assemblyTimer))
</script>

<template>
  <div
    class="vfx-connected vfx-hero-prototype"
    data-vfx-demo="hero"
    data-vfx-hero
  >
    <HeroSplit01
      :locale="locale"
      :badge-text="t('vfxV3.badge').toLocaleUpperCase(locale)"
      :title="t('vfxV3.heading')"
      title-class="text-4xl lg:text-5xl"
      subtitle-class="mx-auto max-w-3xl text-base lg:text-lg"
      cta-wrapper-class="justify-center mt-5"
      :subtitle="t('vfxV3.description')"
      :primary-cta="{ label: t('vfxV3.sales'), href: contactHref }"
      :secondary-cta="{ label: t('vfxV3.browse'), href: '#workflows' }"
      media-wrapper-class="order-last lg:order-first"
      class="gap-6 pt-8 pb-8 text-center md:pt-10 md:pb-8 lg:flex-col lg:gap-12 lg:pb-8"
    >
      <template #badge>
        <div class="flex w-full justify-center">
          <ProductHeroBadge
            :text="t('vfxV3.badge').toLocaleUpperCase(locale)"
          />
        </div>
      </template>
      <template #media>
        <div
          ref="root"
          class="vfx-hero-stage"
          :class="{ 'is-assembled': assembled, 'is-settled': settled }"
        >
          <VfxSampleScene
            v-model:selected="selected"
            v-model:time="time"
            v-model:paused="paused"
            :playback-intent="playbackIntent"
            :variants="variants"
            :source="source"
            :original-label="t('vfxV3.originalFootage')"
            :slider-label="t('modelLaunch.beforeAfter.sliderLabel')"
            :choices-label="t('modelLaunch.beforeAfter.tabsLabel')"
          />
          <button
            type="button"
            class="sr-only focus:not-sr-only focus:mt-4 focus:text-sm focus:text-primary-comfy-yellow focus:underline"
            :aria-pressed="paused"
            @click="togglePlayback"
          >
            {{ paused ? t('player.play') : t('player.pause') }}
          </button>
        </div>
      </template>
    </HeroSplit01>
  </div>
</template>
