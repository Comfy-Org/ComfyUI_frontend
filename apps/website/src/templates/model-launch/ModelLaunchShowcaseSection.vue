<script setup lang="ts">
import { useElementBounding, useElementSize, useWindowSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchShowcase } from './types'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { t } from '../../i18n/translations'

const { locale = 'en', showcase } = defineProps<{
  showcase: ModelLaunchShowcase
  locale?: Locale
}>()

// The strip slides one pixel sideways for every pixel the page scrolls while
// the section is on screen, and stops once its last card is in view.
const sectionRef = useTemplateRef<HTMLElement>('sectionRef')
const trackRef = useTemplateRef<HTMLElement>('trackRef')
const { top } = useElementBounding(sectionRef)
const { width: trackWidth } = useElementSize(trackRef)
const { width: viewportWidth, height: viewportHeight } = useWindowSize()

const trackOffset = computed(() => {
  const scrolledIntoView = Math.max(0, viewportHeight.value - top.value)
  const overflow = Math.max(0, trackWidth.value - viewportWidth.value)
  return -Math.min(scrolledIntoView, overflow)
})
</script>

<template>
  <section ref="sectionRef" class="overflow-hidden py-10 lg:py-14">
    <div class="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
      <p
        v-if="showcase.eyebrowKey"
        class="mb-4 text-sm/tight font-extrabold tracking-wider text-primary-comfy-yellow uppercase"
      >
        {{ t(showcase.eyebrowKey, locale) }}
      </p>
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t(showcase.headingKey, locale) }}
      </h2>
      <p
        v-if="showcase.descriptionKey"
        class="mt-6 text-base/relaxed font-light text-primary-comfy-canvas lg:text-lg/relaxed"
      >
        {{ t(showcase.descriptionKey, locale) }}
      </p>
    </div>

    <div class="mt-10 overflow-hidden motion-reduce:overflow-x-auto lg:mt-12">
      <ul
        ref="trackRef"
        class="flex w-max gap-6 will-change-transform"
        :style="
          prefersReducedMotion()
            ? undefined
            : { transform: `translateX(${trackOffset}px)` }
        "
      >
        <li
          v-for="card in showcase.cards"
          :key="card.id"
          class="aspect-video h-60 shrink-0 overflow-hidden rounded-4.5xl bg-black/40 md:h-80 lg:h-120"
        >
          <img
            :src="card.src"
            :alt="card.alt[locale] || card.alt.en"
            class="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </li>
      </ul>
    </div>
  </section>
</template>
