<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import StepsGrid01 from '../../components/blocks/StepsGrid01.vue'
import { affiliateHowItWorksSteps } from '../../data/affiliateHowItWorks'
import { t } from '../../i18n/translations'

const { locale } = defineProps<{ locale: Locale }>()

const steps = affiliateHowItWorksSteps.map((step) => ({
  id: step.id,
  label: step.label[locale] || step.label.en,
  description: step.description[locale] || step.description.en
}))
</script>

<template>
  <StepsGrid01
    :heading="t('affiliate.howItWorks.heading', locale)"
    :steps="steps"
  />
</template>
