<script setup lang="ts">
import FeatureRows01 from '../../components/blocks/FeatureRows01.vue'
import type { FeatureRow } from '../../components/blocks/FeatureRows01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import RouterProviderLogoRow from './RouterProviderLogoRow.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const providerRows: FeatureRow[] = [
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

const queueRows: FeatureRow[] = [
  {
    id: 'queue',
    title: t('platform.router.section3.heading', locale),
    description: t('platform.router.section3.body', locale),
    media: {
      type: 'image',
      src: '/images/router/queue-job.svg',
      fit: 'cover'
    }
  }
]

const supportedProviders = [
  {
    name: 'fal',
    src: '/icons/router-providers/fal.svg',
    logoClass: 'h-8 w-auto'
  },
  {
    name: 'Runware',
    src: '/icons/router-providers/runware.svg',
    logoClass: 'h-5.5 w-auto'
  },
  {
    name: 'WaveSpeed',
    src: '/icons/router-providers/wavespeed.svg',
    logoClass: 'h-6 w-auto'
  }
]
</script>

<template>
  <FeatureRows01
    :locale="locale"
    :rows="providerRows"
    title-class="text-primary-warm-white"
  />

  <section class="mx-auto max-w-4xl px-6">
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
  </section>

  <FeatureRows01
    :locale="locale"
    :rows="queueRows"
    title-class="text-primary-warm-white"
  />
</template>
