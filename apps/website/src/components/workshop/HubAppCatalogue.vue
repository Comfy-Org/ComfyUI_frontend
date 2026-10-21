<script setup lang="ts">
import { computed } from 'vue'

import { usePagedList } from '@/composables/usePagedList'
import type { Locale } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import type { HubCatalogueApp } from '@/lib/workshop/hub-catalogue-apps'
import { ac, hubOpenApp } from '@/lib/workshop/hub-catalogue-apps'
import { upcomingApps } from '@/lib/workshop/hub-coming-soon-apps'
import { captureHubItemClick } from '@/scripts/hub-analytics'
import { HUB_TOOLBAR_ID } from '@/scripts/hubToolbar'
import CatalogueShowMore from './CatalogueShowMore.vue'
import HubAppCard from './HubAppCard.vue'
import HubRowSeen from './HubRowSeen.vue'

const { apps, locale = 'en' } = defineProps<{
  apps: readonly CatalogueApp[]
  locale?: Locale
}>()

const upcoming = computed(() =>
  upcomingApps(locale).map((app) => ({ app, meta: undefined }))
)
const cards = computed(() => [
  ...apps.map((app) => hubOpenApp(app, locale)),
  ...upcoming.value
])
const { shown, total, hasMore, showMore } = usePagedList(cards)
const openSlugs = computed(() =>
  shown.value.filter(({ app }) => app.href).map(({ app }) => app.key)
)

function openApp(app: HubCatalogueApp, position: number) {
  if (app.href)
    captureHubItemClick(
      { kind: 'app', slug: app.key },
      { surface: 'apps', source: 'app_grid', position }
    )
}
</script>

<template>
  <section aria-labelledby="hub-app-grid" data-testid="apps-catalogue">
    <div
      :id="HUB_TOOLBAR_ID"
      class="sticky top-20 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 bleed-page-band bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
      data-testid="hub-apps-tabs"
    >
      <slot name="tabs" />
    </div>
    <h2 id="hub-app-grid" class="sr-only">{{ ac('apps', locale) }}</h2>
    <div data-testid="app-grid-row">
      <ul
        class="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3"
        data-testid="app-grid"
      >
        <li v-for="({ app, meta }, index) in shown" :key="app.key">
          <HubAppCard :app :meta :locale @click="openApp(app, index)" />
        </li>
      </ul>
      <HubRowSeen
        :view="{
          surface: 'apps',
          source: 'app_grid',
          rowSlugs: openSlugs
        }"
      />
    </div>
    <CatalogueShowMore
      v-if="hasMore"
      :shown="shown.length"
      :total
      :locale
      @more="showMore"
    />
  </section>
</template>
