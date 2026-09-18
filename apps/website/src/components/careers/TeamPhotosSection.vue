<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const photos = [
  {
    src: 'https://media.comfy.org/website/careers/team0.webp',
    alt: t('careers.teamPhotos.team0.alt', locale)
  },
  {
    src: 'https://media.comfy.org/website/careers/team1.webp',
    alt: t('careers.teamPhotos.team1.alt', locale)
  },
  {
    src: 'https://media.comfy.org/website/careers/team2.webp',
    alt: t('careers.teamPhotos.team2.alt', locale)
  },
  {
    src: 'https://media.comfy.org/website/careers/team3.webp',
    alt: t('careers.teamPhotos.team3.alt', locale)
  },
  {
    src: 'https://media.comfy.org/website/careers/team4.webp',
    alt: t('careers.teamPhotos.team4.alt', locale)
  },
  {
    src: 'https://media.comfy.org/website/careers/team5.webp',
    alt: t('careers.teamPhotos.team5.alt', locale)
  },
  {
    src: 'https://media.comfy.org/website/careers/team6.webp',
    alt: t('careers.teamPhotos.team6.alt', locale)
  },
  {
    src: 'https://media.comfy.org/website/careers/team7.webp',
    alt: t('careers.teamPhotos.team7.alt', locale)
  }
]
</script>

<template>
  <section class="py-12 md:py-24">
    <div
      class="flex gap-4 overflow-x-auto px-6 md:gap-6 md:px-20"
      style="scrollbar-width: none"
    >
      <div
        v-for="(photo, i) in photos"
        :key="i"
        class="aspect-3/4 h-64 shrink-0 md:h-96"
      >
        <img
          :src="photo.src"
          :alt="photo.alt"
          class="size-full rounded-2xl object-cover md:rounded-3xl"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  </section>
</template>
