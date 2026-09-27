<script setup lang="ts">
import FeatureRows01 from '../../components/blocks/FeatureRows01.vue'
import type { FeatureRow } from '../../components/blocks/FeatureRows01.vue'
import type { Locale } from '../../i18n/translations'
import { routerT } from './routerCopy'
import RouterProviderLogoRow from './RouterProviderLogoRow.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const rows: FeatureRow[] = [
  {
    id: 'integrate',
    title: routerT('platform.router.section1.heading', locale),
    description: routerT('platform.router.section1.body', locale),
    media: {
      type: 'image',
      src: 'https://media.comfy.org/website/router/integrate-once-v2.webp',
      fit: 'cover'
    }
  },
  {
    id: 'route',
    title: routerT('platform.router.section2.heading', locale),
    description: routerT('platform.router.section2.body', locale),
    media: {
      type: 'image',
      src: 'https://media.comfy.org/website/router/provider-comfy.webp',
      fit: 'cover'
    }
  },
  {
    id: 'queue',
    title: routerT('platform.router.section3.heading', locale),
    description: routerT('platform.router.section3.body', locale),
    media: {
      type: 'image',
      src: 'https://media.comfy.org/website/router/model-stream.webp',
      fit: 'cover'
    }
  }
]

const supportedProviders = [
  {
    name: 'Runware',
    src: '/icons/router-providers/runware.svg',
    logoClass: 'h-8.25 w-auto'
  },
  {
    name: 'fal',
    src: '/icons/router-providers/fal.svg',
    logoClass: 'h-10 w-auto'
  },
  {
    name: 'WaveSpeed',
    src: '/icons/router-providers/wavespeed.svg',
    logoClass: 'h-9 w-auto'
  },
  {
    name: 'Higgsfield',
    src: '/icons/router-providers/higgsfield.svg',
    logoClass: 'h-10 w-auto'
  }
]
</script>

<template>
  <FeatureRows01
    :locale="locale"
    :rows="rows"
    title-class="text-primary-warm-white"
  />

  <section class="mx-auto max-w-6xl px-6 py-16 md:py-24">
    <p
      class="text-center text-xs font-bold tracking-widest text-primary-comfy-yellow uppercase"
    >
      {{ routerT('platform.router.section2.providersLabel', locale) }}
    </p>
    <RouterProviderLogoRow
      :animated="false"
      :providers="supportedProviders"
      class="mt-6"
    />
  </section>
</template>
