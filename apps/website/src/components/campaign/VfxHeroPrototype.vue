<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import {
  useIntersectionObserver,
  usePreferredReducedMotion
} from '@vueuse/core'
import ProductHeroBadge from '@/components/common/ProductHeroBadge.vue'
import HeroSplit01 from '@/components/blocks/HeroSplit01.vue'
import VfxSampleScene from '@/components/campaign/VfxSampleScene.vue'
import { translationsFor } from '@/i18n/translations'
import type { Locale } from '@/i18n/translations'
import '@/styles/workflow-canvas.css'
import '@/styles/vfx-connected.css'
import '@/styles/vfx-hero-prototype.css'

const { locale, contactHref } = defineProps<{
  locale: Locale
  contactHref: string
}>()
const { t } = translationsFor(locale)
const variantIds = [
  'relight_golden',
  'relight_night',
  'relight_blue',
  'relight_rain',
  'relight_snow',
  'relight_day'
] as const
const variants = variantIds.map((id) => ({
  id,
  label: t(`vfxV3.variants.${id}`)
}))
const selected = ref<string>(variants[0].id)
const time = ref(0)
const motion = usePreferredReducedMotion()
const paused = ref(false)
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
  paused.value = motion.value === 'reduce'
})
onUnmounted(() => clearTimeout(assemblyTimer))
</script>

<template>
  <div class="vfx-connected vfx-hero-prototype" data-vfx-demo="hero">
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
            :variants="variants"
            :original-label="t('vfxV3.originalFootage')"
            :slider-label="t('modelLaunch.beforeAfter.sliderLabel')"
            :choices-label="t('modelLaunch.beforeAfter.tabsLabel')"
          />
        </div>
      </template>
    </HeroSplit01>
  </div>
</template>
