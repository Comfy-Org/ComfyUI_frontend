<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import PlatformFeatureGrid from './PlatformFeatureGrid.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const cardNumbers = [1, 2, 3, 4] as const

const cards = cardNumbers.map((n) => ({
  title: t(`platform.builderPillars.${n}.title`),
  description: t(`platform.builderPillars.${n}.description`)
}))
</script>

<template>
  <PlatformFeatureGrid
    :heading="t('platform.builderPillars.heading')"
    :cards="cards"
    :columns="4"
  />
</template>
