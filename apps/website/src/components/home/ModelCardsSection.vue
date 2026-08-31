<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ModelCard from '../common/ModelCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const modelCards = [
  {
    id: 'minimax-h3-text-to-video',
    title: t('products.models.minimaxTextToVideo', locale),
    href: routes.minimax,
    mediaSrc: 'https://media.comfy.org/website/minimax/fluid-poster.webp'
  },
  {
    id: 'flux-3-image-to-video',
    title: t('products.models.fluxImageToVideo', locale),
    href: routes.flux3,
    mediaSrc: 'https://media.comfy.org/website/flux-3/card-2.webm',
    mediaType: 'video' as const
  },
  {
    id: 'seedance-2-5-image-to-video',
    title: t('products.models.seedanceImageToVideo', locale),
    href: routes.seedance,
    mediaSrc:
      'https://media.comfy.org/website/seedance-2.5/balloons-poster.webp'
  },
  {
    id: 'minimax-h3-image-to-video',
    title: t('products.models.minimaxImageToVideo', locale),
    href: routes.minimax,
    mediaSrc: 'https://media.comfy.org/website/minimax/ice-rider-poster.webp'
  }
]
</script>

<template>
  <section class="max-w-9xl mx-auto bg-primary-comfy-ink px-4 py-10 lg:px-20">
    <div
      role="group"
      :aria-label="t('products.models.label', locale)"
      class="bg-transparency-white-t4 rounded-5xl grid grid-cols-1 gap-4 p-4 lg:grid-cols-4 lg:p-2"
    >
      <ModelCard
        v-for="card in modelCards"
        :key="card.id"
        :title="card.title"
        :href="card.href"
        :media-src="card.mediaSrc"
        :media-type="card.mediaType"
      />
    </div>
  </section>
</template>
