<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import { minimaxH3Faqs } from '../../data/minimaxH3'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqs = minimaxH3Faqs.map((faq) => ({
  id: faq.id,
  question: faq.question[locale],
  answer: faq.answer[locale]
}))
</script>

<template>
  <FAQSplit01 :heading="t('minimaxH3.faq.heading', locale)" :faqs="faqs" />
</template>
