<script setup lang="ts">
import { computed } from 'vue'

import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BrandButton from '../common/BrandButton.vue'
import ModelCard from '../common/ModelCard.vue'

type FeaturedModel = {
  modelName: string
  capability: string
  href: string
  providerName: string
  providerLogoSrc: string
  media:
    | { type: 'image'; src: string }
    | { type: 'video'; src: string; poster?: string }
}

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = computed(() => getRoutes(locale))

const models = computed<readonly FeaturedModel[]>(() => [
  {
    providerName: 'MiniMax',
    modelName: 'MiniMax H3 Max',
    capability: t('home.featuredModels.textToVideo', locale),
    href: routes.value.minimax,
    providerLogoSrc: '/icons/ai-models/minimax.svg',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/minimax/fluid.webm',
      poster: 'https://media.comfy.org/website/minimax/fluid-poster.webp'
    }
  },
  {
    providerName: 'Black Forest Labs',
    modelName: 'FLUX 3',
    capability: t('home.featuredModels.imageToVideo', locale),
    href: routes.value.flux3,
    providerLogoSrc: '/icons/ai-models/black-forest-labs.svg',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/flux-3/card-2.webm',
      poster: '/images/flux-3-card-2-poster.webp'
    }
  },
  {
    providerName: 'ByteDance',
    modelName: 'Seedance 2.5',
    capability: t('home.featuredModels.imageToVideo', locale),
    href: routes.value.seedance,
    providerLogoSrc: '/icons/ai-models/bytedance.svg',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/seedance-2.5/balloons.webm',
      poster:
        'https://media.comfy.org/website/seedance-2.5/balloons-poster.webp'
    }
  },
  {
    providerName: 'MiniMax',
    modelName: 'MiniMax H3',
    capability: t('home.featuredModels.imageToVideo', locale),
    href: routes.value.minimax,
    providerLogoSrc: '/icons/ai-models/minimax.svg',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/minimax/ice-rider.webm',
      poster: 'https://media.comfy.org/website/minimax/ice-rider-poster.webp'
    }
  }
])
</script>

<template>
  <section
    :aria-label="t('home.featuredModels.label', locale)"
    class="px-6 py-8 lg:px-12"
  >
    <div class="max-w-9xl mx-auto">
      <div class="bg-transparency-white-t4 rounded-5xl p-4 lg:p-2">
        <div
          class="flex snap-x gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0"
        >
          <ModelCard
            v-for="model in models"
            :key="model.modelName"
            v-bind="model"
            class="w-72 shrink-0 snap-start lg:w-auto"
          />
        </div>

        <div class="flex justify-center px-2 pt-5 pb-2 lg:px-4 lg:pt-5 lg:pb-2">
          <BrandButton :href="routes.modelsShowcase" variant="outline">
            {{ t('home.featuredModels.exploreMore', locale) }}
          </BrandButton>
        </div>
      </div>
    </div>
  </section>
</template>
