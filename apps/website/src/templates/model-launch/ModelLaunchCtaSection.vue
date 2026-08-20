<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchClosingCta } from './types'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { t } from '../../i18n/translations'

const { locale, cta } = defineProps<{
  cta: ModelLaunchClosingCta
  locale: Locale
}>()
</script>

<template>
  <CtaCenter01
    :heading="t(cta.headingKey, locale)"
    :subtitle="cta.subtitleKey ? t(cta.subtitleKey, locale) : undefined"
    :primary-cta="{
      label: t(cta.primaryCta.labelKey, locale),
      href: cta.primaryCta.href,
      target: cta.primaryCta.target
    }"
    :secondary-cta="
      cta.secondaryCta
        ? {
            label: t(cta.secondaryCta.labelKey, locale),
            href: cta.secondaryCta.href,
            target: cta.secondaryCta.target
          }
        : undefined
    "
  />
</template>
