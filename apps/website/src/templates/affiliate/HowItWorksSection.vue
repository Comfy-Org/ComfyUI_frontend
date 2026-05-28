<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import StepsGrid01 from '../../components/blocks/StepsGrid01.vue'
import { affiliateHowItWorksSteps } from '../../data/affiliateHowItWorks'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const steps = affiliateHowItWorksSteps.map((step) => ({
  id: step.id,
  label: step.label[locale],
  description: step.description[locale]
}))
</script>

<template>
  <StepsGrid01
    :heading="t('affiliate.howItWorks.heading', locale)"
    :steps="steps"
  />
</template>
