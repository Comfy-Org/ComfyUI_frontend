<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchClosingCta } from './types'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en', cta } = defineProps<{
  cta: ModelLaunchClosingCta
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <CtaCenter01
    :heading="t(cta.headingKey)"
    :subtitle="cta.subtitleKey ? t(cta.subtitleKey) : undefined"
    :primary-cta="{
      label: t(cta.primaryCta.labelKey),
      href: cta.primaryCta.href,
      target: cta.primaryCta.target
    }"
    :secondary-cta="
      cta.secondaryCta
        ? {
            label: t(cta.secondaryCta.labelKey),
            href: cta.secondaryCta.href,
            target: cta.secondaryCta.target
          }
        : undefined
    "
  />
</template>
