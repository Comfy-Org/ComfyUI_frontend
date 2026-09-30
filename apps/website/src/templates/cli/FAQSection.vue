<script setup lang="ts">
import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import type { Locale } from '../../i18n/site'
import { t } from '../../i18n/site'
import { cliFaqs } from './faqs'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqs = cliFaqs(locale)
</script>

<template>
  <FAQSplit01
    :heading="t('cli.faq.heading', {}, { locale: locale })"
    :faqs="faqs"
  />
</template>
