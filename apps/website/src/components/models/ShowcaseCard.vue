<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import type { ModelCard } from './ModelsShowcaseSection.vue'

import { t } from '../../i18n/translations'

const {
  card,
  href,
  locale = 'en'
} = defineProps<{
  card: ModelCard
  href: string
  locale?: Locale
}>()

const badgeBase =
  'bg-white/20 text-white backdrop-blur-sm transition-colors duration-300 ease-in-out group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink'
</script>

<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="group relative h-80 cursor-pointer overflow-hidden rounded-4xl bg-black/40"
  >
    <video
      v-if="card.imageSrc.endsWith('.webm')"
      :src="card.imageSrc"
      :aria-label="t(card.titleKey, locale)"
      :style="
        card.objectPosition
          ? { objectPosition: card.objectPosition }
          : undefined
      "
      class="size-full object-cover transition-transform duration-600 ease-in-out group-hover:scale-105"
      autoplay
      loop
      muted
      playsinline
    />
    <img
      v-else
      :src="card.imageSrc"
      :alt="t(card.titleKey, locale)"
      :style="
        card.objectPosition
          ? { objectPosition: card.objectPosition }
          : undefined
      "
      class="size-full object-cover transition-transform duration-600 ease-in-out group-hover:scale-105"
      loading="lazy"
      decoding="async"
    />

    <div
      class="absolute inset-0 bg-linear-to-t from-black/50 via-black/5 to-black/35"
    />

    <div
      :class="
        cn(
          'absolute top-5 right-5 flex h-12 min-w-12 items-center justify-center px-3 lg:top-6 lg:right-6',
          badgeBase,
          'rounded-2xl'
        )
      "
    >
      <span
        v-if="card.badgeIcon"
        class="inline-block size-6 bg-current"
        :style="{
          maskImage: `url(${card.badgeIcon})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center'
        }"
      />
      <span
        v-else-if="card.badgeText"
        class="text-xs font-bold tracking-wider lowercase"
      >
        {{ card.badgeText }}
      </span>
    </div>

    <p
      class="text-primary-warm-white absolute inset-x-6 bottom-6 text-2xl/tight font-light whitespace-pre-line drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] lg:top-6 lg:right-auto lg:bottom-auto lg:text-3xl"
    >
      {{ t(card.titleKey, locale) }}
    </p>
  </a>
</template>
