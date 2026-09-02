<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'
import type { ButtonVariants } from '../ui/button'

import { cn } from '@comfyorg/tailwind-utils'

import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import ProductCard from './ProductCard.vue'
import SectionLabel from './SectionLabel.vue'

type Product = 'local' | 'cloud' | 'platform' | 'enterprise'

const {
  locale = 'en',
  excludeProduct,
  labelKey = '',
  ctaKey,
  ctaVariant
} = defineProps<{
  locale?: Locale
  excludeProduct?: Product
  labelKey?: TranslationKey
  ctaKey?: TranslationKey
  ctaVariant?: ButtonVariants['variant']
}>()

const routes = getRoutes(locale)

function cardDef(product: Product, href: string, bg: string) {
  return {
    product,
    title: t(`products.${product}.title`, locale),
    description: t(`products.${product}.description`, locale),
    cta: t(ctaKey ?? `products.${product}.cta`, locale),
    href,
    bg
  }
}

const allCards: (ReturnType<typeof cardDef> & { product: Product })[] = [
  cardDef('local', routes.download, 'bg-primary-warm-gray'),
  cardDef('cloud', routes.cloud, 'bg-secondary-mauve'),
  cardDef('platform', routes.platform, 'bg-primary-comfy-plum'),
  cardDef('enterprise', routes.enterprise, 'bg-secondary-cool-gray')
]

const cards = excludeProduct
  ? allCards.filter((c) => c.product !== excludeProduct)
  : allCards
</script>

<template>
  <section
    class="max-w-9xl mx-auto bg-primary-comfy-ink px-0 py-20 lg:px-20 lg:py-24"
  >
    <!-- Header -->
    <div class="flex flex-col items-center px-4 text-center">
      <SectionLabel v-if="labelKey">
        {{ t(labelKey, locale) }}
      </SectionLabel>
      <h2
        class="mt-4 text-4xl font-light whitespace-pre-line text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t('products.heading', locale) }}
      </h2>
      <p class="mt-4 text-sm text-primary-comfy-canvas/70">
        {{ t('products.subheading', locale) }}
      </p>
    </div>

    <!-- Cards -->
    <div
      role="group"
      :aria-label="t('products.labelProducts', locale)"
      :class="
        cn(
          'bg-transparency-white-t4 rounded-5xl mt-16 grid grid-cols-1 gap-4 p-4 lg:p-2',
          cards.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        )
      "
    >
      <ProductCard
        v-for="card in cards"
        :key="card.product"
        v-bind="card"
        :cta-variant="ctaVariant"
      />
    </div>
  </section>
</template>
