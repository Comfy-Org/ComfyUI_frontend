<script setup lang="ts">
import FeatureRows01 from '../../components/blocks/FeatureRows01.vue'
import type { FeatureRow } from '../../components/blocks/FeatureRows01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import RouterProviderLogoRow from './RouterProviderLogoRow.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const rows: FeatureRow[] = [
  {
    id: 'integrate',
    title: t('platform.router.section1.heading', locale),
    description: t('platform.router.section1.body', locale),
    media: {
      type: 'image',
      src: '/images/router/integrate-once.svg',
      fit: 'cover'
    }
  },
  {
    id: 'route',
    title: t('platform.router.section2.heading', locale),
    description: t('platform.router.section2.body', locale),
    media: {
      type: 'image',
      src: '/images/router/choose-route.svg',
      fit: 'cover'
    }
  }
]

const supportedProviders = [
  {
    name: 'fal',
    src: '/icons/router-providers/fal.svg',
    logoClass: 'w-28'
  },
  {
    name: 'Runware',
    src: '/icons/router-providers/runware.svg',
    logoClass: 'w-36'
  },
  {
    name: 'WaveSpeed',
    src: '/icons/router-providers/wavespeed.svg',
    logoClass: 'w-36'
  }
]
</script>

<template>
  <FeatureRows01 :locale="locale" :rows="rows" />

  <section class="mx-auto max-w-4xl px-6 py-10 lg:py-14">
    <p
      class="text-center text-xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
    >
      {{ t('platform.router.section2.providersLabel', locale) }}
    </p>
    <RouterProviderLogoRow
      :animated="false"
      :providers="supportedProviders"
      class="mt-5"
    />

    <div
      class="mt-10 rounded-3xl border border-white/10 bg-transparency-white-t4 p-6 lg:p-8"
    >
      <h3 class="text-lg font-normal text-primary-warm-white">
        {{ t('platform.router.section2.calloutHeading', locale) }}
      </h3>
      <p class="mt-2 text-sm/relaxed text-primary-comfy-canvas/80">
        {{ t('platform.router.section2.calloutBody', locale) }}
      </p>
    </div>
  </section>
</template>
