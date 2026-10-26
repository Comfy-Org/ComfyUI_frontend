<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { CARD_GRID } from '@/lib/workshop/card-layout'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { ac } from '@/lib/workshop/catalogue-apps'
import { captureHubItemClick } from '@/scripts/hub-analytics'
import { HUB_TOOLBAR_ID } from '@/scripts/hubToolbar'
import HubRowSeen from './HubRowSeen.vue'
import WorkshopAppCard from './WorkshopAppCard.vue'

const { apps, locale = 'en' } = defineProps<{
  apps: readonly CatalogueApp[]
  locale?: Locale
}>()

function openApp(app: CatalogueApp, position: number) {
  if (app.href)
    captureHubItemClick(
      { kind: 'app', slug: app.key },
      { surface: 'apps', source: 'app_row', position }
    )
}
</script>

<template>
  <section data-testid="apps-catalogue">
    <div
      :id="HUB_TOOLBAR_ID"
      class="sticky top-20 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 bleed-page-band bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
      data-testid="workshop-toolbar"
    >
      <slot name="tabs" />
    </div>

    <ul
      :class="CARD_GRID"
      :aria-label="ac('apps', locale)"
      data-testid="app-grid"
    >
      <li v-for="(app, index) in apps" :key="app.key">
        <WorkshopAppCard :app :locale @click="openApp(app, index)" />
      </li>
    </ul>
    <HubRowSeen
      :view="{
        surface: 'apps',
        source: 'app_row',
        rowSlugs: apps.map((app) => app.key)
      }"
    />
  </section>
</template>
