<script setup lang="ts">
import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { platformCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = platformCtas(locale)
</script>

<template>
  <CtaCenter01
    compact
    :heading="t('platform.closing.heading', locale)"
    :primary-cta="ctas.getStarted"
    :secondary-cta="ctas.docs"
  />
</template>
