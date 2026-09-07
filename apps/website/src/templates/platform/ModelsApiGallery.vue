<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { GalleryMedia, ModelsGalleryCard } from './modelsGalleryCards'
import { modelsGalleryCards } from './modelsGalleryCards'

const { locale = 'en', cards = modelsGalleryCards } = defineProps<{
  locale?: Locale
  cards?: ModelsGalleryCard[]
}>()

const rotationIndex = ref(0)

useIntervalFn(() => {
  rotationIndex.value += 1
}, 6000)

const activeMedia = (card: ModelsGalleryCard): GalleryMedia =>
  card.media[rotationIndex.value % card.media.length]

const isVideo = (media: GalleryMedia) => media.src.endsWith('.webm')
</script>

<template>
  <section
    class="max-w-9xl mx-auto px-6 pb-16 md:pb-24 lg:px-16"
    :aria-label="t('platform.modelsGallery.ariaLabel', locale)"
  >
    <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <div
        v-for="card in cards"
        :key="card.titleKey"
        class="relative aspect-square overflow-hidden rounded-3xl bg-black/40"
      >
        <Transition
          enter-active-class="transition-opacity duration-700"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-700"
          leave-to-class="opacity-0"
        >
          <video
            v-if="isVideo(activeMedia(card))"
            :key="activeMedia(card).src"
            :src="activeMedia(card).src"
            :poster="activeMedia(card).posterSrc"
            :aria-label="t(card.titleKey, locale)"
            class="absolute inset-0 size-full object-cover"
            autoplay
            loop
            muted
            playsinline
          >
            <track
              v-if="activeMedia(card).trackSrc"
              kind="descriptions"
              :src="activeMedia(card).trackSrc"
              srclang="en"
              default
            />
          </video>
          <img
            v-else
            :key="activeMedia(card).src"
            :src="activeMedia(card).src"
            :alt="t(card.titleKey, locale)"
            class="absolute inset-0 size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </Transition>

        <div
          class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"
        />

        <div
          class="absolute top-3 right-3 flex size-9 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm lg:top-4 lg:right-4"
        >
          <span
            class="inline-block size-4 bg-current"
            :style="{
              maskImage: `url(${card.badgeIcon})`,
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center'
            }"
          />
        </div>

        <p
          class="text-primary-warm-white absolute bottom-3 left-4 text-base/tight font-medium whitespace-pre-line drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] lg:bottom-4 lg:text-lg"
        >
          {{ t(card.titleKey, locale) }}
        </p>
      </div>
    </div>
  </section>
</template>
