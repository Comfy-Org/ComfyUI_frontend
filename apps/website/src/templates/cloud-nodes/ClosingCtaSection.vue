<script setup lang="ts">
import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import type { Locale } from '../../i18n/site'
import { t } from '../../i18n/site'
import { cloudNodesCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = cloudNodesCtas(locale)
</script>

<template>
  <CtaCenter01
    :heading="t('cloudNodesLaunch.closing.heading', {}, { locale: locale })"
    :subtitle="t('cloudNodesLaunch.closing.subtitle', {}, { locale: locale })"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
  />
</template>
