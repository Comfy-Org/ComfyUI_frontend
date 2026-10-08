<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, nextTick, watch } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { CARD_GRID, SHELF_CARD } from '@/lib/workshop/card-layout'
import type { CatalogueApp } from '@/lib/workshop/catalogue-apps'
import { ac } from '@/lib/workshop/catalogue-apps'
import { captureHubItemClick } from '@/scripts/hub-analytics'
import type { HubItemSource } from '@/scripts/workshop-analytics'
import { HUB_TOOLBAR_ID } from '@/scripts/hubToolbar'
import CardRow from './CardRow.vue'
import WorkshopAppCard from './WorkshopAppCard.vue'

const ROW_LIMIT = 8

const { apps, locale = 'en' } = defineProps<{
  apps: readonly CatalogueApp[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const browseAll = defineModel<boolean>('browseAll', { default: false })
const emit = defineEmits<{ section: [boolean] }>()
watch(browseAll, (value) => emit('section', value), { immediate: true })
watch(browseAll, () => void nextTick(() => window.scrollTo({ top: 0 })))

const shelf = computed(() => apps.slice(0, ROW_LIMIT))
const hasMore = computed(() => apps.length > ROW_LIMIT)

function openApp(app: CatalogueApp, source: HubItemSource, position: number) {
  if (app.href)
    captureHubItemClick(
      { kind: 'app', slug: app.key },
      { surface: 'apps', source, position }
    )
}
</script>

<template>
  <section data-testid="apps-catalogue">
    <template v-if="browseAll">
      <button
        type="button"
        class="-ml-2.5 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="section-back"
        @click="browseAll = false"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        {{ t('workshop.sections.back') }}
      </button>
      <h2
        class="mt-5 mb-4 scroll-mt-24 text-3xl font-bold text-primary-warm-white sm:text-4xl lg:scroll-mt-32"
      >
        {{ ac('allApps', locale) }}
        <span
          class="text-base font-normal text-primary-warm-gray tabular-nums"
          >{{ apps.length }}</span
        >
      </h2>
    </template>
    <div
      :id="HUB_TOOLBAR_ID"
      class="sticky top-20 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
      data-testid="workshop-toolbar"
    >
      <slot name="tabs" />
    </div>

    <ul
      v-if="browseAll"
      :class="CARD_GRID"
      :aria-label="ac('apps', locale)"
      data-testid="app-search-results"
    >
      <li v-for="(app, index) in apps" :key="app.key">
        <WorkshopAppCard :app @click="openApp(app, 'results_grid', index)" />
      </li>
    </ul>

    <div v-else class="flex flex-col gap-12">
      <section aria-labelledby="app-shelf" data-testid="app-shelf">
        <CardRow :locale>
          <template #heading>
            <h2
              id="app-shelf"
              class="text-xl font-medium text-primary-warm-white"
            >
              {{ ac('apps', locale) }}
            </h2>
          </template>
          <li v-for="(app, index) in shelf" :key="app.key" :class="SHELF_CARD">
            <WorkshopAppCard :app @click="openApp(app, 'app_row', index)" />
          </li>
        </CardRow>
      </section>
      <button
        v-if="hasMore"
        type="button"
        class="group mx-auto mt-12 flex w-fit cursor-pointer items-center justify-center gap-2 rounded-2xl border border-transparency-white-t8 px-8 py-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:w-full"
        data-testid="browse-all-end"
        @click="browseAll = true"
      >
        {{ ac('browseAllApps', locale) }}
        <ChevronRight
          class="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </div>
  </section>
</template>
