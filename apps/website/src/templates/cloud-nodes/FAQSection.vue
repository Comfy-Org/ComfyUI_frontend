<script setup lang="ts">
import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const faqNumbers = [1, 2, 3, 4, 5, 6, 7] as const

const faqs = faqNumbers.map((n) => ({
  id: String(n),
  question: t(`cloudNodesLaunch.faq.${n}.q`),
  answer: t(`cloudNodesLaunch.faq.${n}.a`)
}))
</script>

<template>
  <FAQSplit01 :heading="t('cloudNodesLaunch.faq.heading')" :faqs="faqs" />
</template>
