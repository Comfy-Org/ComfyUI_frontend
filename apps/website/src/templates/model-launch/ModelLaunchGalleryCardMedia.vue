<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Maximize2 } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchGalleryCard } from './types'

import { translationsFor } from '@/i18n/translations'

const {
  card,
  locale = 'en',
  overlayCaption = false,
  loadVideo = true
} = defineProps<{
  card: ModelLaunchGalleryCard
  locale?: Locale
  overlayCaption?: boolean
  loadVideo?: boolean
}>()
const emit = defineEmits<{ expand: [] }>()
const { t } = translationsFor(locale)

const name = card.name[locale] || card.name.en
const caption = card.description[locale] || card.description.en
const isExpandable = card.expandable === true && card.media.kind === 'image'
const radiusClass = overlayCaption ? 'rounded-3xl' : 'rounded-4.5xl'
const isFullSpanImage = card.span === 'full' && card.media.kind === 'image'
const scrimClass = overlayCaption
  ? 'bg-linear-to-t from-black/60 via-transparent to-transparent'
  : 'bg-linear-to-b from-black/25 to-transparent'

function shapeClass() {
  if (card.span === 'full') return 'aspect-video md:aspect-3/1'
  return overlayCaption ? 'aspect-square' : 'aspect-19/10'
}
</script>

<template>
  <div
    data-testid="gallery-card-media"
    :class="
      cn(
        'group relative block overflow-hidden bg-black/40',
        radiusClass,
        shapeClass()
      )
    "
  >
    <video
      v-if="card.media.kind === 'video'"
      :src="loadVideo ? card.media.src : undefined"
      :poster="card.media.posterSrc"
      :aria-label="name"
      class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      autoplay
      loop
      muted
      playsinline
      preload="none"
    />
    <img
      v-else
      :src="card.media.src"
      :alt="name"
      :class="
        cn(
          'size-full transition-transform duration-300 group-hover:scale-105',
          isFullSpanImage
            ? 'object-contain object-top md:object-cover md:object-center'
            : 'object-cover'
        )
      "
      loading="lazy"
      decoding="async"
    />

    <div :class="cn('absolute inset-0', scrimClass)" />

    <p
      v-if="overlayCaption"
      :class="
        cn(
          'absolute inset-x-4 bottom-3 text-base/tight font-medium text-primary-warm-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] lg:bottom-4 lg:text-lg',
          isExpandable && 'pr-12 lg:pr-16'
        )
      "
    >
      {{ caption }}
    </p>

    <div
      v-if="card.logoSrc"
      aria-hidden="true"
      class="absolute inset-x-8 top-8 flex items-start justify-end"
    >
      <div
        class="flex size-10 items-center justify-center rounded-2xl bg-transparency-white-t20 text-primary-warm-white backdrop-blur-sm transition-colors group-hover:bg-primary-comfy-yellow group-hover:text-primary-comfy-ink"
      >
        <span
          class="inline-block size-6 bg-current"
          :style="{
            maskImage: `url(${card.logoSrc})`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center'
          }"
        />
      </div>
    </div>

    <button
      v-if="isExpandable"
      type="button"
      :aria-label="t('player.fullscreen')"
      :class="
        cn(
          'absolute inset-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:ring-inset',
          radiusClass
        )
      "
      @click="emit('expand')"
    >
      <span
        data-testid="gallery-card-expand"
        aria-hidden="true"
        class="absolute right-3 bottom-3 flex size-8 items-center justify-center rounded-lg bg-primary-comfy-yellow text-primary-comfy-ink transition-opacity group-hover:opacity-90 lg:right-4 lg:bottom-4 lg:size-10"
      >
        <Maximize2 class="size-3.5 lg:size-4" :stroke-width="2.5" />
      </span>
    </button>
  </div>
</template>
