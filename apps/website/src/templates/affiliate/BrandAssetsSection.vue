<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import BrandAssetsGrid01 from '@/components/blocks/BrandAssetsGrid01.vue'
import { getRoutes } from '@/config/routes'
import { affiliateBrandAssets } from '@/data/affiliateBrandAssets'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const routes = getRoutes(locale)

const assets = affiliateBrandAssets.map((asset) => ({
  id: asset.id,
  title: asset.title[locale] || asset.title.en,
  preview: asset.preview
}))
</script>

<template>
  <BrandAssetsGrid01
    :heading="t('affiliate.assets.heading')"
    :subheading="t('affiliate.assets.subheading')"
    :cta="{
      label: t('affiliate.assets.ctaLabel'),
      href: routes.brand
    }"
    :assets="assets"
  />
</template>
