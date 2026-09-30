<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import PlatformFeatureGrid from './PlatformFeatureGrid.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const cardNumbers = [1, 2, 3, 4] as const

const cards = cardNumbers.map((n) => ({
  title: t(`platform.builderPillars.${n}.title`, {}, { locale: locale }),
  description: t(
    `platform.builderPillars.${n}.description`,
    {},
    { locale: locale }
  )
}))
</script>

<template>
  <PlatformFeatureGrid
    :heading="t('platform.builderPillars.heading', {}, { locale: locale })"
    :cards="cards"
    :columns="4"
  />
</template>
