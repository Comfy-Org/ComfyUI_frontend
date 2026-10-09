<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import CtaCenter01 from '@/components/blocks/CtaCenter01.vue'
import { externalLinks } from '@/config/routes'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <CtaCenter01
    :heading="t('launches.cta.heading')"
    :primary-cta="{
      label: t('launches.cta.primary'),
      href: externalLinks.cloud,
      target: '_blank'
    }"
    :secondary-cta="{
      label: t('launches.cta.secondary'),
      href: externalLinks.workflows,
      target: '_blank'
    }"
  />
</template>
