<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <CtaCenter01
    :heading="t('affiliate.cta.heading', {}, { locale: locale })"
    :primary-cta="{
      label: t('affiliate.cta.apply', {}, { locale: locale }),
      href: externalLinks.affiliateApplicationForm,
      target: '_blank'
    }"
    :terms-link="{
      label: t('affiliate.cta.termsLabel', {}, { locale: locale }),
      href: routes.affiliateTerms
    }"
  />
</template>
