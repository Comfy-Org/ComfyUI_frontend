<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import BenefitsGrid01 from '@/components/blocks/BenefitsGrid01.vue'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const steps = (['step1', 'step2', 'step3', 'step4'] as const).map((step) => ({
  id: step,
  title: t(`fdct.howItWorks.${step}.title`),
  description: t(`fdct.howItWorks.${step}.description`)
}))
</script>

<template>
  <BenefitsGrid01
    :heading="t('fdct.howItWorks.title')"
    :benefits="steps"
    :footnote="t('fdct.howItWorks.footnote')"
  />
</template>
