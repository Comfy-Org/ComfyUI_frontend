<script setup lang="ts">
import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqNumbers = [1, 2, 3, 4, 5, 6] as const

const faqs = faqNumbers.map((n) => ({
  id: String(n),
  question: t(`platform.builderFaq.${n}.q`, locale),
  answer: t(`platform.builderFaq.${n}.a`, locale)
}))
</script>

<template>
  <div class="max-w-9xl mx-auto px-4 pt-10 lg:px-20 lg:pt-14">
    <p
      class="border-primary-comfy-yellow/40 bg-primary-comfy-yellow/5 rounded-2xl border px-5 py-3.5 text-xs text-primary-comfy-canvas"
    >
      {{ t('platform.faq.betaBanner', locale) }}
    </p>
  </div>
  <FAQSplit01
    id="faq"
    compact
    :heading="t('platform.faq.heading', locale)"
    :faqs
  />
</template>
