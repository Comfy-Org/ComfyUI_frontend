<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import PlatformFeatureGrid from './PlatformFeatureGrid.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const cardNumbers = [1, 2, 3, 4, 5, 6] as const

const cards = cardNumbers.map((n) => ({
  title: t(`enterprise.managedBuilds.${n}.title`, locale),
  description: t(`enterprise.managedBuilds.${n}.description`, locale)
}))
</script>

<template>
  <PlatformFeatureGrid
    :heading="t('enterprise.managedBuilds.gridHeading', locale)"
    :cards="cards"
  />
</template>
