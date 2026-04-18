<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import FAQSection from '../../common/FAQSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <FAQSection
    :locale="locale"
    heading-key="cloud.faq.heading"
    faq-prefix="cloud.faq"
    :faq-count="15"
  />
</template>
