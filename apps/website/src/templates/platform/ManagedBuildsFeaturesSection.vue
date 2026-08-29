<script setup lang="ts">
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import PlatformFeatureGrid from './PlatformFeatureGrid.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const routes = getRoutes(locale)

const cardNumbers = [1, 2, 3, 4, 5, 6] as const

const cards = cardNumbers.map((n) => ({
  title: t(`enterprise.managedBuilds.${n}.title`, locale),
  description: t(`enterprise.managedBuilds.${n}.description`, locale),
  ...(n === 3 && {
    link: {
      label: t('enterprise.managedBuilds.3.linkLabel', locale),
      href: routes.platformModels,
      suffix: t('enterprise.managedBuilds.3.linkSuffix', locale)
    }
  }),
  ...(n === 6 && {
    link: {
      label: t('enterprise.managedBuilds.6.linkLabel', locale),
      href: routes.platformServerless,
      suffix: t('enterprise.managedBuilds.6.linkSuffix', locale)
    }
  })
}))
</script>

<template>
  <aside class="max-w-9xl mx-auto px-6 pt-8 text-center lg:pt-10">
    <p
      class="text-primary-comfy-yellow/70 font-mono text-[10px] tracking-widest uppercase"
    >
      {{ t('enterprise.managedBuilds.builderNote.title', locale) }}
    </p>
    <p class="mx-auto mt-2 max-w-xl text-xs/relaxed font-light text-smoke-700">
      {{ t('enterprise.managedBuilds.builderNote.description', locale) }}
      <a
        :href="routes.platformBuilder"
        class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-2 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
      >
        {{ t('enterprise.managedBuilds.aboutBuilder', locale) }}
      </a>
    </p>
  </aside>
  <PlatformFeatureGrid
    :heading="t('enterprise.managedBuilds.gridHeading', locale)"
    :subtitle="t('enterprise.managedBuilds.gridSubtitle', locale)"
    :cards="cards"
  />
</template>
