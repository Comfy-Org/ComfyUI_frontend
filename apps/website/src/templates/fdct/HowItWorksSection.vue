<script setup lang="ts">
import type { Locale } from '../../i18n/site'

import BenefitsGrid01 from '../../components/blocks/BenefitsGrid01.vue'
import { t } from '../../i18n/site'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const steps = (['step1', 'step2', 'step3', 'step4'] as const).map((step) => ({
  id: step,
  title: t(`fdct.howItWorks.${step}.title`, {}, { locale: locale }),
  description: t(`fdct.howItWorks.${step}.description`, {}, { locale: locale })
}))
</script>

<template>
  <BenefitsGrid01
    :heading="t('fdct.howItWorks.title', {}, { locale: locale })"
    :benefits="steps"
    :footnote="t('fdct.howItWorks.footnote', {}, { locale: locale })"
  />
</template>
