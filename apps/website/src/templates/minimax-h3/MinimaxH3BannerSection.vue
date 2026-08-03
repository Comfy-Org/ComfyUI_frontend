<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { minimaxH3Ctas } from '../../data/minimaxH3'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <CtaCenter01
    :heading="t('minimaxH3.banner.heading', locale)"
    :primary-cta="{
      label: t('minimaxH3.banner.primaryCta', locale),
      href: minimaxH3Ctas.runModel,
      target: '_blank'
    }"
    :secondary-cta="{
      label: t('minimaxH3.banner.secondaryCta', locale),
      href: minimaxH3Ctas.workflows,
      target: '_blank'
    }"
  />
</template>
