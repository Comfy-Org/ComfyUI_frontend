<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import type { Reason } from '../shared/ReasonSection.vue'

import ReasonSection from '../shared/ReasonSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons: Reason[] = [
  {
    titleKey: 'enterprise.reason.1.title',
    descriptionKey: 'enterprise.reason.1.description'
  },
  {
    titleKey: 'enterprise.reason.2.title',
    descriptionKey: 'enterprise.reason.2.description'
  },
  {
    titleKey: 'enterprise.reason.3.title',
    descriptionKey: 'enterprise.reason.3.description'
  },
  {
    titleKey: 'enterprise.reason.4.title',
    descriptionKey: 'enterprise.reason.4.description'
  },
  {
    titleKey: 'enterprise.reason.5.title',
    descriptionKey: 'enterprise.reason.5.description'
  }
]
</script>

<template>
  <ReasonSection
    :locale="locale"
    heading-key="enterprise.reason.heading"
    subtitle-key="enterprise.reason.subtitle"
    :reasons="reasons"
  />
</template>
