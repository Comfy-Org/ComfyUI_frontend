<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../../i18n/translations'

import { getRoutes } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import FeatureShowcaseSection from '../shared/FeatureShowcaseSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = computed(() => getRoutes(locale))

const features = computed(() => [
  {
    title: t('enterprise.team.feature1.title', locale),
    description: t('enterprise.team.feature1.description', locale),
    image:
      'https://media.comfy.org/website/enterprise/composition-workflow.webp'
  },
  {
    title: t('enterprise.team.feature2.title', locale),
    description: t('enterprise.team.feature2.description', locale),
    image: 'https://media.comfy.org/website/enterprise/dark-fluid-texture.webp',
    ctaText: t('enterprise.team.feature2.cta', locale),
    ctaHref: routes.value.cloud
  },
  {
    title: t('enterprise.team.feature3.title', locale),
    description: t('enterprise.team.feature3.description', locale),
    image:
      'https://media.comfy.org/website/enterprise/isometric-interface.webp',
    ctaText: t('enterprise.hero.contactSales', locale),
    ctaHref: routes.value.contact
  }
])
</script>

<template>
  <FeatureShowcaseSection
    :heading="t('enterprise.team.heading', locale)"
    :subtitle="t('enterprise.team.subtitle', locale)"
    :features="features"
  />
</template>
