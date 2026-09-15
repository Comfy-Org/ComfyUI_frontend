<script setup lang="ts">
import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { cloudNodesCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = cloudNodesCtas(locale)
</script>

<template>
  <CtaCenter01
    :heading="t('cloudNodesLaunch.closing.heading', locale)"
    :subtitle="t('cloudNodesLaunch.closing.subtitle', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
  />
</template>
