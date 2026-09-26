<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type {
  SortOrder,
  WorkflowWorkshopModel
} from '../../config/models-catalogue'
import {
  filterWorkshopModels,
  sortWorkshopModels
} from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CardRow from './CardRow.vue'
import FeaturedBanner from './FeaturedBanner.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'
import WorkshopSearchField from './WorkshopSearchField.vue'
import WorkshopSortMenu from './WorkshopSortMenu.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly WorkflowWorkshopModel[]
  locale?: Locale
}>()

const query = ref('')
const selected = ref<string[]>([])
const sort = ref<SortOrder>('popular')
const browseAll = defineModel<boolean>('browseAll', { default: false })
const emit = defineEmits<{ section: [boolean] }>()
watch(browseAll, (value) => emit('section', value), { immediate: true })
watch(browseAll, () => {
  query.value = ''
  selected.value = []
  void nextTick(() => window.scrollTo({ top: 0 }))
})
onMounted(() => {
  const params = new URLSearchParams(location.search)
  query.value = params.get('q') ?? ''
  selected.value = params
    .getAll('category')
    .filter((id) => models.some((model) => model.category === id))
})

const rows = computed(() =>
  models
    .filter(
      (model, index) =>
        models.findIndex((other) => other.category === model.category) === index
    )
    .map((category) => ({
      id: category.category ?? '',
      label:
        category.categoryLabel?.[locale === 'zh-CN' ? locale : 'en'] ??
        category.category ??
        '',
      order: category.categoryOrder ?? Infinity,
      models: models
        .filter((model) => model.category === category.category)
        .sort((a, b) =>
          sort.value === 'name'
            ? a.name.localeCompare(b.name)
            : (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity)
        )
    }))
    .sort((a, b) => a.order - b.order)
)
const options = computed(() =>
  rows.value.map((category) => ({
    value: category.id,
    label: category.label,
    count: category.models.length
  }))
)
const matchingCategories = computed(() =>
  rows.value.flatMap((category) =>
    !selected.value.length || selected.value.includes(category.id)
      ? category.models
      : []
  )
)
const visible = computed(() => {
  const matching = filterWorkshopModels(matchingCategories.value, {
    query: query.value
  })
  return sort.value === 'popular'
    ? matching
    : sortWorkshopModels(matching, sort.value)
})
const browsing = computed(
  () => !query.value.trim() && !selected.value.length && !browseAll.value
)
const featured = computed(() =>
  rows.value.flatMap((category) =>
    category.models.filter((model) => model.categoryHighlight)
  )
)

function clear() {
  query.value = ''
  selected.value = []
}
function leaveSection() {
  browseAll.value = false
  clear()
}
</script>

<template>
  <section data-testid="workflow-catalogue">
    <template v-if="browseAll">
      <button
        type="button"
        class="-ml-1 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1 text-sm font-medium text-primary-warm-gray opacity-60 transition hover:text-primary-comfy-yellow hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
        data-testid="section-back"
        @click="leaveSection"
      >
        <ChevronLeft class="size-4" aria-hidden="true" />
        {{ t('workshop.sections.back', locale) }}
      </button>
      <h1
        class="mt-3 mb-4 scroll-mt-24 text-3xl font-bold text-primary-warm-white sm:text-4xl lg:scroll-mt-32"
      >
        {{ t('workshop.catalogue.allWorkflows', locale) }}
        <span
          class="text-base font-normal text-primary-warm-gray tabular-nums"
          >{{ visible.length }}</span
        >
      </h1>
    </template>
    <div
      class="sticky top-20 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
    >
      <div class="flex min-w-0 flex-1 items-center gap-3 max-sm:basis-full">
        <WorkshopSearchField
          v-model="query"
          :models="matchingCategories"
          :locale
          kind="workflows"
          compact
          class="min-w-0 flex-1 sm:ml-auto sm:max-w-xl"
        />
        <WorkshopFilterMenu
          v-model:use-cases="selected"
          kind="workflows"
          :use-case-options="options"
          :result-count="visible.length"
          :locale
        />
        <WorkshopSortMenu
          v-model="sort"
          :orders="['popular', 'name']"
          recommended
          :locale
        />
      </div>
    </div>

    <FeaturedBanner
      v-if="browsing && featured.length"
      :models="featured"
      :locale
      :autoplay="false"
      class="mb-10 short:mb-6"
    />

    <div v-if="browsing" class="flex flex-col gap-12">
      <section
        v-for="category in rows"
        :key="category.id"
        :aria-labelledby="`workflow-category-${category.id}`"
        :data-testid="`workflow-category-${category.id}`"
      >
        <CardRow :locale>
          <template #heading>
            <h2
              :id="`workflow-category-${category.id}`"
              class="text-xl font-medium text-primary-warm-white"
            >
              {{ category.label }}
            </h2>
          </template>
          <li
            v-for="model in category.models"
            :key="model.slug"
            class="w-60 shrink-0 snap-start sm:w-[calc((100cqw-2*1.25rem)/2.5)] md:w-[calc((100cqw-3*1.25rem)/3.5)] lg:w-[calc((100cqw-4*1.25rem)/4.5)] xl:w-[calc((100cqw-5*1.25rem)/5.5)]"
          >
            <WorkshopModelCard :model :locale />
          </li>
        </CardRow>
      </section>
      <button
        type="button"
        class="group mx-auto mt-12 flex w-fit cursor-pointer items-center justify-center gap-2 rounded-2xl border border-transparency-white-t8 px-8 py-4 text-sm font-medium text-primary-comfy-canvas transition-colors outline-none hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 max-sm:w-full"
        data-testid="browse-all-end"
        @click="browseAll = true"
      >
        {{ t('workshop.catalogue.browseAllWorkflows', locale) }}
        <ChevronRight
          class="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </div>

    <ul
      v-else-if="visible.length"
      class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
      :aria-label="t('workshop.hub.workflows', locale)"
      data-testid="workflow-search-results"
    >
      <li v-for="model in visible" :key="model.slug">
        <WorkshopModelCard :model :locale />
      </li>
    </ul>
    <div
      v-else
      class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-transparency-white-t8 px-6 py-16 text-center"
    >
      <p class="text-lg font-semibold text-primary-comfy-canvas">
        {{ t('workshop.catalogue.noWorkflows', locale) }}
      </p>
      <Button variant="outline" size="sm" @click="clear">
        {{ t('workshop.empty.clear', locale) }}
      </Button>
    </div>
  </section>
</template>
