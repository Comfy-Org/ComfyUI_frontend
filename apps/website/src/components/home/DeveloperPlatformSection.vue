<script setup lang="ts">
import type { Locale } from '../../i18n/site'
import { t } from '../../i18n/site'
import { getRoutes } from '../../config/routes'
import ClosingCtaSection from '../../templates/platform/ClosingCtaSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const routes = getRoutes(locale)
</script>

<template>
  <ClosingCtaSection
    :locale="locale"
    visual="shader"
    badge-only
    :primary-href="routes.platform"
    :subtitle="t('home.platform.body', {}, { locale: locale })"
  />
</template>
