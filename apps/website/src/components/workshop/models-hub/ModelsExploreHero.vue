<script setup lang="ts">
import { computed } from 'vue'

import CatalogueHero from '@/components/workshop/CatalogueHero.vue'
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { modelFeatures } from '@/lib/workshop/catalogue-features'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const features = computed(() => modelFeatures(models, locale))
</script>

<template>
  <CatalogueHero
    :title="t('workshop.hero.eyebrow')"
    :subtitle="t('workshop.modelsHub.subtitle')"
    :features
    :features-label="t('auth.hero.carouselLabel')"
    :locale
    data-testid="models-hub-hero"
  />
</template>
