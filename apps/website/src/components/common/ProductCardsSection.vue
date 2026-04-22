<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import ProductCard from './ProductCard.vue'

type Product = 'local' | 'cloud' | 'api' | 'enterprise'

const {
  locale = 'en',
  excludeProduct,
  labelKey = ''
} = defineProps<{
  locale?: Locale
  excludeProduct?: Product
  labelKey?: TranslationKey
}>()

const routes = getRoutes(locale)

function cardDef(product: Product, href: string, bg: string) {
  return {
    product,
    title: t(`products.${product}.title`, locale),
    description: t(`products.${product}.description`, locale),
    cta: t(`products.${product}.cta`, locale),
    href,
    bg
  }
}

const allCards: (ReturnType<typeof cardDef> & { product: Product })[] = [
  cardDef('local', routes.download, 'bg-primary-warm-gray'),
  cardDef('cloud', routes.cloud, 'bg-secondary-mauve'),
  cardDef('api', routes.api, 'bg-primary-comfy-plum'),
  cardDef('enterprise', routes.cloudEnterprise, 'bg-illustration-forest')
]

const cards = excludeProduct
  ? allCards.filter((c) => c.product !== excludeProduct)
  : allCards
</script>

<template>
  <section class="bg-primary-comfy-ink px-4 py-20 lg:px-20 lg:py-24">
    <!-- Header -->
    <div class="flex flex-col items-center text-center">
      <p
        v-if="labelKey"
        class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
      >
        {{ t(labelKey, locale) }}
      </p>
      <h2
        class="text-primary-comfy-canvas mt-4 text-4xl font-light whitespace-pre-line lg:text-5xl"
      >
        {{ t('products.heading', locale) }}
      </h2>
      <p class="text-primary-comfy-canvas/70 mt-4 text-sm">
        {{ t('products.subheading', locale) }}
      </p>
    </div>

    <!-- Cards -->
    <div
      :class="
        cn(
          'mt-16 grid grid-cols-1 gap-4',
          cards.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        )
      "
    >
      <ProductCard v-for="card in cards" :key="card.product" v-bind="card" />
    </div>
  </section>
</template>
