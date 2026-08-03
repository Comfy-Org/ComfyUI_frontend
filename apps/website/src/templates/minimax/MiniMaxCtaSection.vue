<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { minimaxLinks } from '../../data/minimax'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <CtaCenter01
    :heading="t('minimax.cta.heading', locale)"
    :primary-cta="{
      label: t('minimax.cta.primaryCta', locale),
      href: minimaxLinks.cloudRun,
      target: '_blank'
    }"
    :secondary-cta="{
      label: t('minimax.cta.secondaryCta', locale),
      href: minimaxLinks.imageToVideo,
      target: '_blank'
    }"
  />
</template>
