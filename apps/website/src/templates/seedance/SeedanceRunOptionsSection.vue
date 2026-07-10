<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import ProductCard from '../../components/common/ProductCard.vue'
import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const cards = [
  { product: 'local', href: routes.download, bg: 'bg-primary-warm-gray' },
  { product: 'cloud', href: routes.cloud, bg: 'bg-secondary-mauve' },
  { product: 'api', href: routes.api, bg: 'bg-primary-comfy-plum' },
  {
    product: 'enterprise',
    href: routes.cloudEnterprise,
    bg: 'bg-secondary-cool-gray'
  }
] as const
</script>

<template>
  <section
    class="max-w-9xl mx-auto bg-primary-comfy-ink px-0 py-20 lg:px-20 lg:py-24"
  >
    <div class="flex flex-col items-center px-4 text-center">
      <h2
        class="text-3xl font-light tracking-tight text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t('seedance.runOptions.heading', locale) }}
      </h2>
      <p class="mt-6 max-w-xl text-sm font-light text-primary-comfy-canvas/70">
        {{ t('seedance.runOptions.subtitle', locale) }}
      </p>
    </div>

    <div
      class="rounded-5xl bg-transparency-white-t4 mt-16 grid grid-cols-1 gap-4 p-4 lg:grid-cols-4 lg:p-2"
    >
      <ProductCard
        v-for="card in cards"
        :key="card.product"
        :title="t(`products.${card.product}.title`, locale)"
        :description="t(`products.${card.product}.description`, locale)"
        :cta="t(`products.${card.product}.cta`, locale)"
        :href="card.href"
        :bg="card.bg"
      />
    </div>
  </section>
</template>
