<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import SharedReasonSection from '../shared/ReasonSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons = [
  {
    title: t('download.reason.1.title', locale),
    description: t('download.reason.1.description', locale)
  },
  {
    title: t('download.reason.2.title', locale),
    description: t('download.reason.2.description', locale)
  },
  {
    title: t('download.reason.3.title', locale),
    description: t('download.reason.3.description', locale)
  },
  {
    title: t('download.reason.4.title', locale),
    description: t('download.reason.4.description', locale)
  }
]
</script>

<template>
  <SharedReasonSection
    :heading="t('download.reason.heading', locale)"
    :heading-highlight="t('download.reason.headingHighlight', locale)"
    :reasons="reasons"
  />
</template>
