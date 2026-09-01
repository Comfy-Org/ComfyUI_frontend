<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import BenefitsGrid01 from '../../components/blocks/BenefitsGrid01.vue'
import { externalLinks } from '../../config/routes'
import { affiliateBenefits } from '../../data/affiliateBenefits'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const benefits = affiliateBenefits.map((benefit) => ({
  id: benefit.id,
  description: benefit.description[locale]
}))
</script>

<template>
  <BenefitsGrid01
    :heading="t('affiliate.benefits.heading', locale)"
    :benefits="benefits"
    :primary-cta="{
      label: t('affiliate.hero.apply', locale),
      href: externalLinks.affiliateApplicationForm,
      target: '_blank'
    }"
  />
</template>
