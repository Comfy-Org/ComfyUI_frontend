<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { getRoutes } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import FeatureShowcaseSection from '../shared/FeatureShowcaseSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const features = [
  {
    title: t('enterprise.team.feature1.title', locale),
    description: t('enterprise.team.feature1.description', locale)
  },
  {
    title: t('enterprise.team.feature2.title', locale),
    description: t('enterprise.team.feature2.description', locale),
    ctaText: t('enterprise.team.feature2.cta', locale),
    ctaHref: routes.cloud
  },
  {
    title: t('enterprise.team.feature3.title', locale),
    description: t('enterprise.team.feature3.description', locale),
    ctaText: t('enterprise.hero.contactSales', locale),
    ctaHref: routes.contact
  }
]
</script>

<template>
  <FeatureShowcaseSection
    :heading="t('enterprise.team.heading', locale)"
    :subtitle="t('enterprise.team.subtitle', locale)"
    :features="features"
  />
</template>
