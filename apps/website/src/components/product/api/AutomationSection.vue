<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import FeatureShowcaseSection from '../shared/FeatureShowcaseSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const features = [
  {
    title: t('api.automation.feature1.title', locale),
    description: t('api.automation.feature1.description', locale),
    description2: t('api.automation.feature1.description2', locale)
  },
  {
    title: t('api.automation.feature2.title', locale),
    description: t('api.automation.feature2.description', locale),
    description2: t('api.automation.feature2.description2', locale)
  },
  {
    title: t('api.automation.feature3.title', locale),
    description: t('api.automation.feature3.description', locale)
  }
]
</script>

<template>
  <FeatureShowcaseSection
    :heading="t('api.automation.heading', locale)"
    :subtitle="t('api.automation.subtitle', locale)"
    :features="features"
  />
</template>
