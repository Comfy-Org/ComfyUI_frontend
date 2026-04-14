<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import ProductCard from '../common/ProductCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)

const cards = [
  {
    title: t('products.local.title', locale),
    description: t('products.local.description', locale),
    cta: t('products.local.cta', locale),
    href: routes.download,
    bg: 'bg-primary-warm-gray'
  },
  {
    title: t('products.cloud.title', locale),
    description: t('products.cloud.description', locale),
    cta: t('products.cloud.cta', locale),
    href: routes.cloud,
    bg: 'bg-secondary-mauve'
  },
  {
    title: t('products.api.title', locale),
    description: t('products.api.description', locale),
    cta: t('products.api.cta', locale),
    href: routes.api,
    bg: 'bg-primary-comfy-plum'
  },
  {
    title: t('products.enterprise.title', locale),
    description: t('products.enterprise.description', locale),
    cta: t('products.enterprise.cta', locale),
    href: routes.cloudEnterprise,
    bg: 'bg-illustration-forest'
  }
]
</script>

<template>
  <section class="bg-primary-comfy-ink px-4 py-40 lg:px-20">
    <!-- Header -->
    <div class="flex flex-col items-center text-center">
      <p
        class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
      >
        {{ t('products.label', locale) }}
      </p>
      <h2
        class="text-primary-comfy-canvas mt-4 text-4xl font-light whitespace-pre-line lg:text-5xl"
      >
        {{ t('products.heading', locale) }}
      </h2>
      <p class="text-primary-warm-gray mt-4 text-sm">
        {{ t('products.subheading', locale) }}
      </p>
    </div>

    <!-- Cards -->
    <div class="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <ProductCard v-for="card in cards" :key="card.title" v-bind="card" />
    </div>
  </section>
</template>
