<script setup lang="ts">
import FAQSplit01 from '@/components/blocks/FAQSplit01.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { cliFaqs } from './faqs'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const faqs = cliFaqs(locale)
</script>

<template>
  <FAQSplit01 :heading="t('cli.faq.heading')" :faqs="faqs" />
</template>
