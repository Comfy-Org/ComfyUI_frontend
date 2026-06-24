<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { getRoutes } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import SectionLabel from '../../common/SectionLabel.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const cards = [
  {
    titleKey: 'products.local.title',
    descriptionKey: 'products.local.description',
    ctaKey: 'products.local.cta',
    href: routes.download
  },
  {
    titleKey: 'products.cloud.title',
    descriptionKey: 'products.cloud.description',
    ctaKey: 'products.cloud.cta',
    href: routes.cloud
  },
  {
    titleKey: 'products.api.title',
    descriptionKey: 'products.api.description',
    ctaKey: 'products.api.cta',
    href: routes.api
  },
  {
    titleKey: 'products.enterprise.title',
    descriptionKey: 'products.enterprise.description',
    ctaKey: 'products.enterprise.cta',
    href: routes.cloudEnterprise
  }
] as const
</script>

<template>
  <section class="max-w-9xl mx-auto px-0 py-20 lg:px-20 lg:py-24">
    <div class="mb-10 flex flex-col items-center px-4 text-center">
      <SectionLabel>{{ t('products.labelProducts', locale) }}</SectionLabel>
      <h2
        class="mt-4 text-4xl font-light whitespace-pre-line text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t('products.heading', locale) }}
      </h2>
    </div>

    <!-- Cards container with grape/purple bg matching Figma #4d3762 -->
    <div
      class="bg-secondary-mauve rounded-5xl grid grid-cols-1 gap-2 p-2 lg:grid-cols-4"
    >
      <a
        v-for="card in cards"
        :key="card.titleKey"
        :href="card.href"
        class="flex min-h-[400px] flex-col overflow-hidden rounded-[36px] bg-primary-comfy-ink p-8 transition-opacity hover:opacity-90"
      >
        <h3
          class="text-3xl/tight font-light tracking-tight whitespace-pre-line text-primary-comfy-canvas lg:text-4xl"
        >
          {{ t(card.titleKey, locale) }}
        </h3>

        <div class="mt-auto flex flex-col gap-4 pt-8">
          <p class="text-sm/relaxed text-white/80">
            {{ t(card.descriptionKey, locale) }}
          </p>
          <span
            class="bg-primary-comfy-yellow flex h-12 w-full items-center justify-center rounded-2xl text-xs font-bold whitespace-nowrap text-primary-comfy-ink uppercase"
          >
            {{ t(card.ctaKey, locale) }}
          </span>
        </div>
      </a>
    </div>
  </section>
</template>
