<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import SharedReasonSection from '../shared/ReasonSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons = [
  {
    title: t('enterprise.reason.1.title', locale),
    description: t('enterprise.reason.1.description', locale)
  },
  {
    title: t('enterprise.reason.2.title', locale),
    description: t('enterprise.reason.2.description', locale)
  },
  {
    title: t('enterprise.reason.3.title', locale),
    description: t('enterprise.reason.3.description', locale)
  },
  {
    title: t('enterprise.reason.4.title', locale),
    description: t('enterprise.reason.4.description', locale)
  },
  {
    title: t('enterprise.reason.5.title', locale),
    description: t('enterprise.reason.5.description', locale)
  }
]
</script>

<template>
  <SharedReasonSection
    :heading="t('enterprise.reason.heading', locale)"
    :subtitle="t('enterprise.reason.subtitle', locale)"
    :reasons="reasons"
  />
</template>
