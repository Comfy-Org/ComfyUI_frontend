<script setup lang="ts">
import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import type { Locale } from '../../i18n/site'
import { t } from '../../i18n/site'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const faqs = faqNumbers.map((n) => ({
  id: String(n),
  question: t(`mcp.faq.${n}.q`, {}, { locale: locale }),
  answer: t(`mcp.faq.${n}.a`, {}, { locale: locale })
}))
</script>

<template>
  <FAQSplit01
    :heading="t('mcp.faq.heading', {}, { locale: locale })"
    :faqs="faqs"
  />
</template>
