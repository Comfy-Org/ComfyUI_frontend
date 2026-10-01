<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchShowcase } from './types'

import { t } from '../../i18n/translations'

const { locale = 'en', showcase } = defineProps<{
  showcase: ModelLaunchShowcase
  locale?: Locale
}>()
</script>

<template>
  <section class="overflow-hidden py-10 lg:py-14">
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

    <div
      class="group mt-10 flex gap-6 overflow-hidden motion-reduce:overflow-x-auto lg:mt-12"
    >
      <ul
        v-for="copy in 2"
        :key="copy"
        class="flex shrink-0 animate-marquee gap-6 group-hover:paused"
        :class="copy === 2 && 'motion-reduce:hidden'"
        :style="{ '--marquee-gap': '1.5rem', animationDuration: '60s' }"
        :aria-hidden="copy === 2 ? 'true' : undefined"
      >
        <li
          v-for="card in showcase.cards"
          :key="card.id"
          class="aspect-video h-60 shrink-0 overflow-hidden rounded-4.5xl bg-black/40 md:h-80 lg:h-120"
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
