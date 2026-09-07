<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import FAQSection from '../../common/FAQSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <FAQSection
    :locale
    heading-key="cloud.faq.heading"
    faq-prefix="cloud.faq"
    :faq-count="12"
    footer-key="cloud.faq.footer"
  />
</template>
