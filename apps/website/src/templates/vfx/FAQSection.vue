<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import FAQSplit01 from '@/components/blocks/FAQSplit01.vue'
import { vfxFaqs } from '@/data/vfx'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <FAQSplit01 id="faq" :heading="t('vfx.faq.title')" :faqs="vfxFaqs(locale)" />
</template>
