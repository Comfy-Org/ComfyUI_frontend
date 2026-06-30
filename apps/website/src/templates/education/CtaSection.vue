<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <CtaCenter01
    :heading="t('education.cta.heading', locale)"
    :primary-cta="{
      label: t('education.cta.choosePlan', locale),
      href: '#plans'
    }"
    :secondary-cta="{
      label: t('education.cta.startLearning', locale),
      href: routes.learning
    }"
    :terms-link="{
      label: t('education.cta.termsLabel', locale),
      href: routes.cloudPricing
    }"
  />
</template>
