<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <CtaCenter01
    :heading="t('seedance.cta.heading', locale)"
    :subtitle="t('seedance.cta.subtitle', locale)"
    :primary-cta="{
      label: t('seedance.cta.primaryCta', locale),
      href: externalLinks.workflows,
      target: '_blank'
    }"
    :secondary-cta="{
      label: t('seedance.cta.secondaryCta', locale),
      href: externalLinks.workflows,
      target: '_blank'
    }"
  />
</template>
