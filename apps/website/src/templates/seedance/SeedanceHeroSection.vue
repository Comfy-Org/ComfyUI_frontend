<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { externalLinks } from '../../config/routes'
import BrandButton from '../../components/common/BrandButton.vue'
import NodeBadge from '../../components/common/NodeBadge.vue'
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import { seedanceHeroVideo } from '../../data/seedance'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-12 lg:px-20 lg:py-16">
    <div class="relative">
      <VideoPlayer :locale :src="seedanceHeroVideo" autoplay loop />

      <div
        class="pointer-events-none absolute inset-x-0 top-0 bottom-24 flex flex-col items-center justify-center gap-6 px-6 text-center"
      >
        <NodeBadge
          :segments="[
            { text: t('seedance.hero.badge', locale) },
            { logoSrc: '/icons/logo.svg', logoAlt: 'Comfy' }
          ]"
          text-class="text-lg uppercase lg:text-2xl"
          size-class="h-12"
          segment-class="px-4 lg:px-5"
        />
        <h1
          class="text-5xl font-light text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:text-6xl lg:text-7xl"
        >
          {{ t('seedance.hero.title', locale) }}
        </h1>
      </div>
    </div>

    <div class="mx-auto mt-10 flex max-w-2xl flex-col items-center text-center">
      <p
        class="text-base/relaxed font-light text-primary-comfy-canvas lg:text-lg/relaxed"
      >
        {{ t('seedance.hero.description', locale) }}
      </p>

      <div class="mt-8 flex flex-col gap-4 sm:flex-row">
        <BrandButton
          :href="externalLinks.workflows"
          target="_blank"
          variant="solid"
          size="lg"
          class="text-center lg:min-w-52 lg:p-4"
        >
          {{ t('seedance.hero.primaryCta', locale) }}
        </BrandButton>
        <BrandButton
          :href="externalLinks.workflows"
          target="_blank"
          variant="outline"
          size="lg"
          class="text-center lg:min-w-52 lg:p-4"
        >
          {{ t('seedance.hero.secondaryCta', locale) }}
        </BrandButton>
      </div>

      <p class="text-primary-warm-gray mt-6 text-xs">
        {{ t('seedance.hero.footnote', locale) }}
      </p>
    </div>
  </section>
</template>
