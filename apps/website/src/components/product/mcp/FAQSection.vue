<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import FAQSection from '../../common/FAQSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <FAQSection
    :locale="locale"
    heading-key="mcp.faq.heading"
    faq-prefix="mcp.faq"
    :faq-count="8"
  />
</template>
