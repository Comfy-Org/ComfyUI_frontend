<script setup lang="ts">
import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

const faqs = faqNumbers.map((n) => ({
  id: String(n),
  question: t(`platform.faq.${n}.q`, locale),
  answer: t(`platform.faq.${n}.a`, locale)
}))
</script>

<template>
  <FAQSplit01
    id="faq"
    compact
    :heading="t('platform.faq.heading', locale)"
    :faqs
  />
</template>
