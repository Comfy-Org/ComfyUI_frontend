<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import { ArrowRight } from '@lucide/vue'

import FAQSplit01 from '../../components/blocks/FAQSplit01.vue'
import Button from '../../components/ui/button/Button.vue'
import { fdctFaqs, fdctPage } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const faqs = fdctFaqs(locale)
</script>

<template>
  <FAQSplit01 :heading="t('fdct.faq.title', locale)" :faqs="faqs">
    <template #footer>
      <Button
        as="a"
        variant="link"
        :href="fdctPage.ctas.applyFdct"
        target="_blank"
        rel="noopener noreferrer"
        :append-icon="ArrowRight"
        class="text-left whitespace-normal"
      >
        {{ t('fdct.faq.applyCta', locale) }}
      </Button>
    </template>
  </FAQSplit01>
</template>
