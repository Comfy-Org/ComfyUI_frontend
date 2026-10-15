<script setup lang="ts">
import { computed } from 'vue'

import { usePagedList } from '@/composables/usePagedList'
import type { Locale } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/hub-catalogue-apps'
import { ac, appMeta } from '@/lib/workshop/hub-catalogue-apps'
import { captureHubItemClick } from '@/scripts/hub-analytics'
import CatalogueShowMore from './CatalogueShowMore.vue'
import HubAppCard from './HubAppCard.vue'

const {
  apps,
  upcoming = [],
  locale = 'en'
} = defineProps<{
  apps: readonly CatalogueApp[]
  upcoming?: readonly CatalogueApp[]
  locale?: Locale
}>()

const cards = computed(() => [
  ...apps.map((app) => ({ app, meta: appMeta(app.key, locale) })),
  ...upcoming.map((app) => ({
    app: { ...app, href: undefined },
    meta: undefined
  }))
])
const { shown, total, hasMore, showMore } = usePagedList(cards)

function openApp(app: CatalogueApp, position: number) {
  if (app.href)
    captureHubItemClick(
      { kind: 'app', slug: app.key },
      { surface: 'apps', source: 'results_grid', position }
    )
}
</script>

<template>
  <section data-testid="apps-catalogue">
    <ul
      class="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3"
      :aria-label="ac('apps', locale)"
      data-testid="app-grid"
    >
      <li v-for="({ app, meta }, index) in shown" :key="app.key">
        <HubAppCard :app :meta :locale @click="openApp(app, index)" />
      </li>
    </ul>
    <CatalogueShowMore
      v-if="hasMore"
      :shown="shown.length"
      :total
      :locale
      @more="showMore"
    />
  </section>
</template>
