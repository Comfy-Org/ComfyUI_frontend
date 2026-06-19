<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import HeroCenter01 from '../../components/blocks/HeroCenter01.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <HeroCenter01
    :visual="{
      src: '/affiliates/brand/comfy-amplified-logo.png',
      alt: t('drops.hero.visualAlt', locale),
      width: 632,
      height: 632
    }"
    :title="t('drops.hero.title', locale)"
    :primary-cta="{
      label: t('drops.hero.primary', locale),
      href: routes.download
    }"
    :secondary-cta="{
      label: t('drops.hero.secondary', locale),
      href: externalLinks.cloud,
      target: '_blank'
    }"
  />
</template>
