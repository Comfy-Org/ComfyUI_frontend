<script setup lang="ts">
import { computed } from 'vue'

import { usePagedList } from '@/composables/usePagedList'
import type { Locale } from '@/i18n/translations'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { ac, appMeta } from '@/lib/workshop/catalogue-apps'
import CatalogueShowMore from './CatalogueShowMore.vue'
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

const cards = computed(() => [
  ...apps.map((app) => ({ app, meta: appMeta(app.key, locale) })),
  ...upcoming.map((app) => ({
    app: { ...app, href: undefined },
    meta: undefined
  }))
])
const { shown, total, hasMore, showMore } = usePagedList(cards)
</script>

<template>
  <section data-testid="apps-catalogue">
    <ul
      class="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3"
      :aria-label="ac('apps', locale)"
      data-testid="app-grid"
    >
      <li v-for="{ app, meta } in shown" :key="app.key">
        <WorkshopAppCard :app :meta :locale />
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
