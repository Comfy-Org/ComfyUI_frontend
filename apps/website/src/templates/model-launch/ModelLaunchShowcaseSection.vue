<script setup lang="ts">
import { useElementHover, useElementSize, useToggle } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchShowcase } from './types'

import { translationsFor } from '@/i18n/translations'

const { locale = 'en', showcase } = defineProps<{
  showcase: ModelLaunchShowcase
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const MARQUEE_GAP_PX = 24
const TRACK_SPEED_PX_PER_SECOND = 190

type ShowcaseCard = ModelLaunchShowcase['cards'][number]

const hasSubhead = Boolean(showcase.descriptionKey || showcase.cta)
const cardAlt = (card: ShowcaseCard) => card.alt[locale] || card.alt.en

// The strip renders twice so the marquee can loop seamlessly. The second copy
// is decorative: hidden below lg and for reduced motion, and invisible to
// assistive tech.
const strips = [
  {
    id: 'strip',
    class: 'flex shrink-0 gap-6 lg:motion-safe:animate-marquee',
    ariaHidden: undefined,
    inert: false,
    altFor: cardAlt
  },
  {
    id: 'loop',
    class:
      'hidden shrink-0 gap-6 lg:motion-safe:flex lg:motion-safe:animate-marquee',
    ariaHidden: 'true',
    inert: true,
    altFor: () => ''
  }
] as const

const stripRef = useTemplateRef<HTMLElement>('stripRef')
const isHovered = useElementHover(stripRef)
const [isPinnedStill, togglePinnedStill] = useToggle(false)
const marqueePlayState = computed(() =>
  isHovered.value && !isPinnedStill.value ? 'running' : 'paused'
)

// Every strip travels at the same speed, so a strip with more cards takes
// proportionally longer to complete one loop.
const track = computed(() => {
  const first = stripRef.value?.firstElementChild
  return typeof HTMLElement !== 'undefined' && first instanceof HTMLElement
    ? first
    : undefined
})
const { width: trackWidth } = useElementSize(track)
const loopDuration = computed(
  () => `${(trackWidth.value + MARQUEE_GAP_PX) / TRACK_SPEED_PX_PER_SECOND}s`
)
</script>

<template>
  <section class="overflow-hidden py-10 lg:py-14">
    <div class="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t(showcase.headingKey) }}
      </h2>
      <p
        v-if="hasSubhead"
        class="mt-6 text-base/relaxed font-light text-primary-comfy-canvas lg:text-lg/relaxed"
      >
        <template v-if="showcase.descriptionKey">{{
          t(showcase.descriptionKey)
        }}</template>
        <a
          v-if="showcase.cta"
          :href="showcase.cta.href"
          :target="showcase.cta.target"
          rel="noopener"
          class="ms-1 whitespace-nowrap text-primary-comfy-yellow transition-opacity hover:opacity-70"
          >{{ t(showcase.cta.labelKey) }}</a
        >
      </p>
    </div>

    <div
      ref="stripRef"
      data-testid="model-launch-showcase-strip"
      class="mt-10 flex snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto px-4 lg:mt-12 lg:cursor-pointer lg:px-0 lg:motion-safe:overflow-hidden"
      @click="togglePinnedStill()"
    >
      <ul
        v-for="strip in strips"
        :key="strip.id"
        :class="strip.class"
        :style="{
          '--marquee-gap': '1.5rem',
          animationDuration: loopDuration,
          animationPlayState: marqueePlayState
        }"
        :aria-hidden="strip.ariaHidden"
        :inert="strip.inert"
      >
        <li
          v-for="card in showcase.cards"
          :key="card.id"
          class="aspect-3/2 h-52 shrink-0 snap-start overflow-hidden rounded-4.5xl bg-black/40 md:h-80 lg:h-120"
        >
          <img
            :src="card.src"
            :alt="strip.altFor(card)"
            class="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </li>
      </ul>
    </div>
  </section>
</template>
