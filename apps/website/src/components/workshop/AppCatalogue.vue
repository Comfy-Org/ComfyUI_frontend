<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, nextTick, watch } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { AppWorkshopModel } from '../../config/models-catalogue'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import { ac } from '../../lib/workshop/catalogue-apps'
import CardRow from './CardRow.vue'
import WorkshopAppCard from './WorkshopAppCard.vue'

const ROW_LIMIT = 8

const { apps, locale = 'en' } = defineProps<{
  apps: readonly AppWorkshopModel[]
  locale?: Locale
}>()

const browseAll = defineModel<boolean>('browseAll', { default: false })
const emit = defineEmits<{ section: [boolean] }>()
watch(browseAll, (value) => emit('section', value), { immediate: true })
watch(browseAll, () => void nextTick(() => window.scrollTo({ top: 0 })))

const cards = computed<readonly CatalogueApp[]>(() =>
  apps.map((app) => ({
    key: app.slug,
    name: app.name,
    task: ac(app.appId === 'studio' ? 'studioTask' : 'reshootTask', locale),
    href: app.href,
    image: app.thumbnail?.url ?? app.thumbnailUrl
  }))
)
const shelf = computed(() => cards.value.slice(0, ROW_LIMIT))
const hasMore = computed(() => cards.value.length > ROW_LIMIT)
</script>

<template>
  <section data-testid="apps-catalogue">
    <template v-if="browseAll">
      <button
        type="button"
        class="-ml-1 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="section-back"
        @click="browseAll = false"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        {{ t('workshop.sections.back', locale) }}
      </button>
      <h1
        class="mt-3 mb-4 scroll-mt-24 text-3xl font-bold text-primary-warm-white sm:text-4xl lg:scroll-mt-32"
      >
        {{ ac('allApps', locale) }}
        <span
          class="text-base font-normal text-primary-warm-gray tabular-nums"
          >{{ cards.length }}</span
        >
      </h1>
    </template>
    <div
      class="sticky top-20 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
      data-testid="workshop-toolbar"
    >
      <slot name="tabs" />
    </div>

    <ul
      v-if="browseAll"
      class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
      :aria-label="ac('apps', locale)"
      data-testid="app-search-results"
    >
      <li v-for="app in cards" :key="app.key">
        <WorkshopAppCard :app />
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
          <li
            v-for="app in shelf"
            :key="app.key"
            class="w-60 shrink-0 snap-start sm:w-[calc((100cqw-2*1.25rem)/2.5)] md:w-[calc((100cqw-3*1.25rem)/3.5)] lg:w-[calc((100cqw-4*1.25rem)/4.5)] xl:w-[calc((100cqw-5*1.25rem)/5.5)]"
          >
            <WorkshopAppCard :app />
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
