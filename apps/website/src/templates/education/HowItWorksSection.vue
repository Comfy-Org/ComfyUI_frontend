<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import StepsSplit01 from '../../components/blocks/StepsSplit01.vue'
import { educationSteps } from '../../data/educationSteps'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const steps = educationSteps.map((step) => ({
  id: step.id,
  title: step.title[locale],
  description: step.description[locale]
}))

const mediaSrc = 'https://media.comfy.org/website/edu/how-it-works.png'
</script>

<template>
  <StepsSplit01
    :heading="t('education.howItWorks.heading', locale)"
    :steps="steps"
    :media="{
      type: 'image',
      src: mediaSrc,
      alt: t('education.howItWorks.mediaAlt', locale)
    }"
  />
</template>
