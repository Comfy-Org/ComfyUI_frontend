<script setup lang="ts">
import type { Locale } from '../../i18n/site'

import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import { affiliateFaqs } from '../../data/affiliateFaq'
import { t } from '../../i18n/site'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqs = affiliateFaqs.map((faq) => ({
  id: faq.id,
  question: faq.question[locale] || faq.question.en,
  answer: faq.answer[locale] || faq.answer.en
}))
</script>

<template>
  <FAQSplit01
    :heading="t('affiliate.faq.heading', {}, { locale: locale })"
    :faqs="faqs"
  />
</template>
