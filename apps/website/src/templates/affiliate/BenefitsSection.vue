<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import BenefitsGrid01 from '../../components/blocks/BenefitsGrid01.vue'
import { externalLinks } from '../../config/routes'
import { affiliateBenefits } from '../../data/affiliateBenefits'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const benefits = affiliateBenefits.map((benefit) => ({
  id: benefit.id,
  description: benefit.description[locale] || benefit.description.en
}))
</script>

<template>
  <BenefitsGrid01
    :heading="t('affiliate.benefits.heading')"
    :benefits="benefits"
    :primary-cta="{
      label: t('affiliate.hero.apply'),
      href: externalLinks.affiliateApplicationForm,
      target: '_blank'
    }"
  />
</template>
