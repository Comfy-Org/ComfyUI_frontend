<script setup lang="ts">
import CtaCenter01 from '../../components/blocks/CtaCenter01.vue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <CtaCenter01
    compact
    :heading="t('enterprise.managedBuilds.closing.heading', locale)"
    :primary-cta="{
      label: t('enterprise.managedBuilds.talkToUs', locale),
      href: routes.contact
    }"
    :secondary-cta="{
      label: t('enterprise.managedBuilds.aboutBuilder', locale),
      href: routes.platformBuilder
    }"
  />
</template>
