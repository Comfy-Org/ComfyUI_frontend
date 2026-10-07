<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { ac, appMeta } from '@/lib/workshop/catalogue-apps'
import WorkshopAppCard from './WorkshopAppCard.vue'

const {
  apps,
  upcoming = [],
  locale = 'en'
} = defineProps<{
  apps: readonly CatalogueApp[]
  upcoming?: readonly CatalogueApp[]
  locale?: Locale
}>()

// The catalogue page binds a browse-all section for every listing; the apps
// list is one grid with none to open, so the binding stays off the markup.
defineOptions({ inheritAttrs: false })
</script>

<template>
  <section data-testid="apps-catalogue">
    <ul
      class="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3"
      :aria-label="ac('apps', locale)"
      data-testid="app-grid"
    >
      <li v-for="app in apps" :key="app.key">
        <WorkshopAppCard :app :meta="appMeta(app.key, locale)" :locale />
      </li>
      <li v-for="app in upcoming" :key="app.key">
        <WorkshopAppCard :app="{ ...app, href: undefined }" :locale />
      </li>
    </ul>
  </section>
</template>
