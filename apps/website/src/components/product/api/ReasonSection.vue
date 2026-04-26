<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import type { Reason } from '../shared/ReasonSection.vue'

import ReasonSection from '../shared/ReasonSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons: Reason[] = [
  {
    titleKey: 'api.reason.1.title',
    descriptionKey: 'api.reason.1.description'
  },
  {
    titleKey: 'api.reason.2.title',
    descriptionKey: 'api.reason.2.description'
  },
  {
    titleKey: 'api.reason.3.title',
    descriptionKey: 'api.reason.3.description'
  },
  {
    titleKey: 'api.reason.4.title',
    descriptionKey: 'api.reason.4.description'
  }
]
</script>

<template>
  <ReasonSection
    :locale="locale"
    heading-key="api.reason.heading"
    heading-highlight-key="api.reason.headingHighlight"
    heading-suffix-key="api.reason.headingSuffix"
    subtitle-key="api.reason.subtitle"
    :reasons="reasons"
  />
</template>
