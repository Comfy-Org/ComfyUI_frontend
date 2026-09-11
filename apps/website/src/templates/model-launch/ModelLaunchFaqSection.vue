<script setup lang="ts">
import { computed } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { ModelLaunchFaqSection } from './types'

import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import { t } from '../../i18n/translations'
import { resolveFaqPairs } from '../../utils/faqPairs'

const { locale = 'en', faq } = defineProps<{
  faq: ModelLaunchFaqSection
  locale?: Locale
}>()

// Shared with the FAQPage JSON-LD in `ModelLaunchPage.astro`, which resolved
// the same items separately and has to reach the same answer.
const faqs = computed(() => resolveFaqPairs(faq.items, locale))
</script>

<template>
  <FAQSplit01 :heading="t(faq.headingKey, locale)" :faqs="faqs" />
</template>
