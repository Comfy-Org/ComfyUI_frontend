<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import BenefitsGrid01 from '@/components/blocks/BenefitsGrid01.vue'
import { externalLinks } from '@/config/routes'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const benefits = (['control', 'open', 'infrastructure', 'api'] as const).map(
  (id) => ({
    id,
    title: t(`vfx.why.${id}.title`),
    description: t(`vfx.why.${id}.description`)
  })
)
</script>

<template>
  <BenefitsGrid01
    :heading="t('vfx.why.heading')"
    :benefits
    :numbered="false"
    :footnote="t('vfx.why.footnote')"
    :primary-cta="{
      label: t('vfx.why.trustCenterCta'),
      href: externalLinks.trustCenter,
      target: '_blank'
    }"
  />
</template>
