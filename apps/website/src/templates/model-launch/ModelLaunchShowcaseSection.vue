<script setup lang="ts">
import { useElementHover } from '@vueuse/core'
import { useTemplateRef } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchShowcase } from './types'

import { t } from '../../i18n/translations'

const { locale = 'en', showcase } = defineProps<{
  showcase: ModelLaunchShowcase
  locale?: Locale
}>()

const stripRef = useTemplateRef<HTMLElement>('stripRef')
const isHovered = useElementHover(stripRef)
</script>

<template>
  <section class="overflow-hidden py-10 lg:py-14">
    <div class="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
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

    <div
      ref="stripRef"
      data-testid="model-launch-showcase-strip"
      class="mt-10 flex gap-6 overflow-hidden motion-reduce:overflow-x-auto lg:mt-12"
    >
      <ul
        v-for="copy in 2"
        :key="copy"
        class="flex shrink-0 animate-marquee gap-6"
        :class="copy === 2 && 'motion-reduce:hidden'"
        :style="{
          '--marquee-gap': '1.5rem',
          animationDuration: '40s',
          animationPlayState: isHovered ? 'running' : 'paused'
        }"
        :aria-hidden="copy === 2 ? 'true' : undefined"
      >
        <li
          v-for="card in showcase.cards"
          :key="card.id"
          class="aspect-3/2 h-60 shrink-0 overflow-hidden rounded-4.5xl bg-black/40 md:h-80 lg:h-120"
        >
          <img
            :src="card.src"
            :alt="copy === 2 ? '' : card.alt[locale] || card.alt.en"
            class="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </li>
      </ul>
    </div>
  </section>
</template>
