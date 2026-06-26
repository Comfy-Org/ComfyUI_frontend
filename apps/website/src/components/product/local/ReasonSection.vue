<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import type { Reason } from '../shared/ReasonSection.vue'

import ReasonSection from '../shared/ReasonSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons: Reason[] = [
  {
    titleKey: 'download.reason.1.title',
    descriptionKey: 'download.reason.1.description'
  },
  {
    titleKey: 'download.reason.2.title',
    descriptionKey: 'download.reason.2.description'
  },
  {
    titleKey: 'download.reason.3.title',
    descriptionKey: 'download.reason.3.description'
  },
  {
    titleKey: 'download.reason.4.title',
    descriptionKey: 'download.reason.4.description'
  }
]
</script>

<template>
  <ReasonSection
    :locale="locale"
    heading-key="download.reason.heading"
    heading-highlight-key="download.reason.headingHighlight"
    highlight-class="text-primary-warm-white"
    :reasons="reasons"
  />
</template>
