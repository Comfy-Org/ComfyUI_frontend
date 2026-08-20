<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import { fdctFaqs } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale } = defineProps<{ locale: Locale }>()

const faqs = fdctFaqs(locale)
</script>

<template>
  <FAQSplit01 :heading="t('fdct.faq.title', locale)" :faqs="faqs" />
</template>
