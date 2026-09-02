<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { ModalityFilter, WorkshopModel } from '../../config/workshop'
import {
  MODALITY_FILTERS,
  countByModality,
  filterWorkshopModels
} from '../../config/workshop'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import WorkshopModelCard from './WorkshopModelCard.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkshopModel[]
  locale?: Locale
}>()

const query = ref('')
const modality = ref<ModalityFilter>('all')

const counts = computed(() => countByModality(models))
const visible = computed(() =>
  filterWorkshopModels(models, { query: query.value, modality: modality.value })
)
const filters = computed(() =>
  MODALITY_FILTERS.filter((filter) => counts.value[filter] > 0)
)
const isFiltered = computed(
  () => query.value !== '' || modality.value !== 'all'
)

const filterLabelKey: Record<ModalityFilter, TranslationKey> = {
  all: 'workshop.filter.all',
  image: 'workshop.filter.image',
  video: 'workshop.filter.video',
  audio: 'workshop.filter.audio',
  '3d': 'workshop.filter.3d',
  text: 'workshop.filter.text',
  other: 'workshop.filter.other'
}

function clearFilters() {
  query.value = ''
  modality.value = 'all'
}
</script>

<template>
  <section>
    <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center">
      <label class="relative block w-full lg:max-w-sm">
        <span class="sr-only">{{ t('workshop.search.label', locale) }}</span>
        <Search
          class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary-warm-gray"
          aria-hidden="true"
        />
        <input
          v-model="query"
          type="search"
          :placeholder="t('workshop.search.label', locale)"
          data-testid="workshop-search"
          class="bg-transparency-white-t4 focus-visible:border-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 h-11 w-full rounded-2xl border border-transparency-white-t20 pr-10 pl-11 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          v-if="query"
          type="button"
          :aria-label="t('workshop.search.clear', locale)"
          class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-primary-warm-gray hover:text-primary-warm-white"
          @click="query = ''"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </label>

      <div
        role="group"
        :aria-label="t('workshop.filter.label', locale)"
        class="flex flex-wrap gap-2"
        data-testid="workshop-filters"
      >
        <button
          v-for="filter in filters"
          :key="filter"
          type="button"
          :aria-pressed="modality === filter"
          :class="
            cn(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-bold tracking-wider uppercase transition-colors',
              modality === filter
                ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                : 'bg-transparency-white-t4 text-primary-comfy-canvas hover:bg-transparency-white-t8'
            )
          "
          @click="modality = filter"
        >
          {{ t(filterLabelKey[filter], locale) }}
          <span class="opacity-60">{{ counts[filter] }}</span>
        </button>
      </div>
    </div>

    <p
      class="mb-4 text-xs text-primary-warm-gray"
      aria-live="polite"
      data-testid="workshop-count"
    >
      {{ visible.length }} {{ t('workshop.count.models', locale) }}
    </p>

    <div v-if="visible.length" class="rounded-4xl bg-white/8 p-2">
      <ul
        class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-testid="workshop-models-grid"
      >
        <li v-for="model in visible" :key="model.slug">
          <WorkshopModelCard :model :locale />
        </li>
      </ul>
    </div>

    <div
      v-else
      class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-transparency-white-t8 px-6 py-16 text-center"
      data-testid="workshop-empty"
    >
      <p class="text-lg font-semibold text-primary-comfy-canvas">
        {{ t('workshop.empty.heading', locale) }}
      </p>
      <p class="text-sm text-primary-warm-gray">
        {{ t('workshop.empty.body', locale) }}
      </p>
      <Button
        v-if="isFiltered"
        variant="outline"
        size="sm"
        @click="clearFilters"
      >
        {{ t('workshop.empty.clear', locale) }}
      </Button>
    </div>
  </section>
</template>
