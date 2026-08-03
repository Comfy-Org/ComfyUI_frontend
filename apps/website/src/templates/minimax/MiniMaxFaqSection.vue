<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import { minimaxFaqs } from '../../data/minimax'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqs = minimaxFaqs.map((faq) => ({
  id: faq.id,
  question: faq.question[locale],
  answer: faq.answer[locale]
}))
</script>

<template>
  <FAQSplit01 :heading="t('minimax.faq.heading', locale)" :faqs="faqs" />
</template>
