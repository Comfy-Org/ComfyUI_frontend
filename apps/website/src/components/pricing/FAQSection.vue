<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import FAQSplit01 from '../blocks/FAQSplit01.vue'
import { pricingFaqs } from '../../data/pricingFaq'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqs = pricingFaqs.map((faq) => ({
  id: faq.id,
  question: faq.question[locale],
  answer: faq.answer[locale]
}))
</script>

<template>
  <FAQSplit01 id="faq" :heading="t('pricing.faq.heading', locale)" :faqs />
</template>
