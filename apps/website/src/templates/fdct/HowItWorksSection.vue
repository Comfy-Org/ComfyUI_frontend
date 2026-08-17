<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import BenefitsGrid01 from '../../components/blocks/BenefitsGrid01.vue'
import { t } from '../../i18n/translations'

const { locale } = defineProps<{ locale: Locale }>()

const steps = (['step1', 'step2', 'step3', 'step4'] as const).map((step) => ({
  id: step,
  title: t(`fdct.howItWorks.${step}.title`, locale),
  description: t(`fdct.howItWorks.${step}.description`, locale)
}))
</script>

<template>
  <BenefitsGrid01
    :heading="t('fdct.howItWorks.title', locale)"
    :benefits="steps"
    :footnote="t('fdct.howItWorks.footnote', locale)"
  />
</template>
