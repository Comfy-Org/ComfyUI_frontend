<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchFaqSection } from './types'

import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', faq } = defineProps<{
  faq: ModelLaunchFaqSection
  locale?: Locale
}>()

const faqs = faq.items.map((item) => ({
  id: item.id,
  question: item.question[locale],
  answer: item.answer[locale]
}))
</script>

<template>
  <FAQSplit01 :heading="t(faq.headingKey, locale)" :faqs="faqs" />
</template>
