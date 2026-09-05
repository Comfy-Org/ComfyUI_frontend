<script setup lang="ts">
import BenefitsGrid01 from '../../components/blocks/BenefitsGrid01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { cloudNodesCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = cloudNodesCtas(locale)

const benefitNumbers = [1, 2, 3, 4] as const

const benefits = benefitNumbers.map((n) => ({
  id: String(n),
  title: t(`cloudNodesLaunch.howItWorks.${n}.title`, locale),
  description: t(`cloudNodesLaunch.howItWorks.${n}.description`, locale)
}))
</script>

<template>
  <BenefitsGrid01
    :heading="t('cloudNodesLaunch.howItWorks.heading', locale)"
    :benefits="benefits"
    :footnote="t('cloudNodesLaunch.howItWorks.footnote', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
  />
</template>
