<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import SharedReasonSection from '../shared/ReasonSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons = [
  {
    title: t('api.reason.1.title', locale),
    description: t('api.reason.1.description', locale)
  },
  {
    title: t('api.reason.2.title', locale),
    description: t('api.reason.2.description', locale)
  },
  {
    title: t('api.reason.3.title', locale),
    description: t('api.reason.3.description', locale)
  },
  {
    title: t('api.reason.4.title', locale),
    description: t('api.reason.4.description', locale)
  }
]
</script>

<template>
  <SharedReasonSection
    :heading="t('api.reason.heading', locale)"
    :heading-highlight="t('api.reason.headingHighlight', locale)"
    :heading-suffix="t('api.reason.headingSuffix', locale)"
    :subtitle="t('api.reason.subtitle', locale)"
    :reasons="reasons"
  />
</template>
