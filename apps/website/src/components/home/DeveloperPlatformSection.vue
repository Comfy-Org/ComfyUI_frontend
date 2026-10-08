<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { getRoutes } from '@/config/routes'
import ClosingCtaSection from '@/templates/platform/ClosingCtaSection.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
const routes = getRoutes(locale)
</script>

<template>
  <ClosingCtaSection
    :locale="locale"
    visual="shader"
    badge-only
    :primary-href="routes.platform"
    :subtitle="t('home.platform.body')"
  />
</template>
