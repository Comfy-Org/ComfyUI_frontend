<script setup lang="ts">
import type { Locale, TranslationKey } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import SharedFAQSection from '../../common/FAQSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqKeys: Array<{ q: TranslationKey; a: TranslationKey }> = Array.from(
  { length: 8 },
  (_, i) => ({
    q: `download.faq.${i + 1}.q` as TranslationKey,
    a: `download.faq.${i + 1}.a` as TranslationKey
  })
)

const items = faqKeys.map(({ q, a }) => ({
  question: t(q, locale),
  answer: t(a, locale)
}))
</script>

<template>
  <SharedFAQSection
    :heading="t('download.faq.heading', locale)"
    :items="items"
  />
</template>
