<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import { seedanceFaqs } from '../../data/seedance'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqs = seedanceFaqs.map((faq) => ({
  id: faq.id,
  question: faq.question[locale],
  answer: faq.answer[locale]
}))
</script>

<template>
  <FAQSplit01 :heading="t('seedance.faq.heading', locale)" :faqs="faqs" />
</template>
