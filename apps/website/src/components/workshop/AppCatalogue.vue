<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, nextTick, watch } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { CARD_GRID, SHELF_CARD } from '../../lib/workshop/card-layout'
import type { CatalogueApp } from '../../lib/workshop/catalogue-apps'
import { ac } from '../../lib/workshop/catalogue-apps'
import { COMING_SOON_APPS } from '../../lib/workshop/coming-soon-apps'
import CardRow from './CardRow.vue'
import WorkshopAppCard from './WorkshopAppCard.vue'

const ROW_LIMIT = 8

const { apps, locale = 'en' } = defineProps<{
  apps: readonly CatalogueApp[]
  locale?: Locale
}>()

const browseAll = defineModel<boolean>('browseAll', { default: false })
const emit = defineEmits<{ section: [boolean] }>()
watch(browseAll, (value) => emit('section', value), { immediate: true })
watch(browseAll, () => void nextTick(() => window.scrollTo({ top: 0 })))

const featured = computed(() => apps[0])
const shelf = computed(() => apps.slice(0, ROW_LIMIT))
const hasMore = computed(() => apps.length > ROW_LIMIT)
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
      <h2
        class="mt-3 mb-4 scroll-mt-24 text-3xl font-bold text-primary-warm-white sm:text-4xl lg:scroll-mt-32"
      >
        {{ ac('allApps', locale) }}
        <span
          class="text-base font-normal text-primary-warm-gray tabular-nums"
          >{{ apps.length }}</span
        >
      </h2>
    </template>

    <ul
      v-if="browseAll"
      :class="CARD_GRID"
      :aria-label="ac('apps', locale)"
      data-testid="app-search-results"
    >
      <li v-for="app in apps" :key="app.key">
        <WorkshopAppCard :app />
      </li>
    </ul>

    <div v-else class="flex flex-col gap-12">
      <a
        v-if="featured"
        :href="featured.href"
        class="group grid overflow-hidden rounded-3xl bg-hub-surface outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 md:grid-cols-2"
        data-testid="app-featured"
      >
        <div class="aspect-video overflow-hidden md:aspect-auto">
          <img
            v-if="featured.image"
            :src="featured.image"
            alt=""
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            decoding="async"
          />
        </div>
        <div class="flex flex-col justify-center gap-3 p-6 lg:p-10">
          <p class="text-sm font-medium text-primary-comfy-yellow">
            {{ ac('featured', locale) }}
          </p>
          <h2 class="text-2xl font-medium text-primary-warm-white lg:text-3xl">
            {{ featured.name }}
          </h2>
          <p class="text-content-secondary">{{ featured.task }}</p>
          <span
            class="mt-3 inline-flex h-11 w-fit items-center rounded-2xl bg-primary-comfy-yellow px-6 text-sm font-bold text-primary-comfy-ink"
          >
            {{ ac('tryFree', locale) }}
          </span>
        </div>
      </a>
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
          <li v-for="app in shelf" :key="app.key" :class="SHELF_CARD">
            <WorkshopAppCard :app />
          </li>
        </CardRow>
        <div
          class="mt-4 flex flex-wrap items-center gap-2"
          data-testid="app-coming-soon"
        >
          <span class="mr-1 text-sm text-content-secondary">
            {{ ac('comingSoon', locale) }}
          </span>
          <span
            v-for="name in COMING_SOON_APPS"
            :key="name"
            class="rounded-full border border-transparency-white-t8 px-3 py-1 text-sm text-content-secondary"
          >
            {{ name }}
          </span>
        </div>
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
