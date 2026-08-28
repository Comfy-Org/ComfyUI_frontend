<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import BuilderVisual from './BuilderVisual.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    compact
    badge-text="Enterprise"
    :title="t('enterprise.managedBuilds.heading', locale)"
    :subtitle="t('enterprise.managedBuilds.hero.subtitle', locale)"
    :primary-cta="{
      label: t('enterprise.managedBuilds.talkToUs', locale),
      href: routes.contact
    }"
  >
    <template #media>
      <BuilderVisual />
    </template>
  </HeroSplit01>
</template>
