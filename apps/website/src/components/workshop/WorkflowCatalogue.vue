<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import type { ComponentExposed } from 'vue-component-type-helpers'

import Button from '@/components/ui/button/Button.vue'
import type {
  SortOrder,
  WorkflowWorkshopModel
} from '@/config/models-catalogue'
import { sortWorkshopModels } from '@/config/models-catalogue'
import { searchWorkshopModels } from '@/config/models-search'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { HUB_TOOLBAR_ID } from '@/scripts/hubToolbar'
import CardRow from './CardRow.vue'
import { CARD_GRID, SHELF_CARD } from '@/lib/workshop/card-layout'
import type { FilterChip } from './WorkshopFilterChips.vue'
import WorkshopFilterChips from './WorkshopFilterChips.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import WorkshopModelCard from './WorkshopModelCard.vue'
import WorkshopSearchField from './WorkshopSearchField.vue'
import WorkshopSortMenu from './WorkshopSortMenu.vue'

const {
  models,
  initialSearch,
  locale = 'en'
} = defineProps<{
  models: readonly WorkflowWorkshopModel[]
  initialSearch?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

// The catalogue page binds a browse-all section for every listing; this one
// lists its rows and its search results with no section of its own to open.
defineOptions({ inheritAttrs: false })

const query = ref('')
const selected = ref<string[]>([])
const runsOn = ref<string[]>([])
const sort = ref<SortOrder>('popular')
const filterMenu =
  useTemplateRef<ComponentExposed<typeof WorkshopFilterMenu>>('filterMenu')
onMounted(() => {
  const params = new URLSearchParams(initialSearch ?? location.search)
  query.value = params.get('q') ?? ''
  selected.value = params
    .getAll('category')
    .filter((id) => models.some((model) => model.category === id))
  runsOn.value = params
    .getAll('model')
    .filter((name) => models.some((model) => model.models?.includes(name)))
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
// An outcome is reached through the model it runs on as often as through the
// task it performs, and one workflow can stand on several.
const modelOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const model of models)
    for (const name of model.models ?? [])
      counts.set(name, (counts.get(name) ?? 0) + 1)
  return [...counts]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
})
const matchingCategories = computed(() =>
  rows.value.flatMap((category) =>
    !selected.value.length || selected.value.includes(category.id)
      ? category.models.filter(
          (model) =>
            !runsOn.value.length ||
            model.models?.some((name) => runsOn.value.includes(name))
        )
      : []
  )
)
const searched = computed(
  () => new Set(searchWorkshopModels(models, { query: query.value }))
)
const visible = computed(() => {
  const matching = matchingCategories.value.filter((model) =>
    searched.value.has(model)
  )
  return sort.value === 'popular'
    ? matching
    : sortWorkshopModels(matching, sort.value)
})
const browsing = computed(
  () => !query.value.trim() && !selected.value.length && !runsOn.value.length
)
const POPULAR_LIMIT = 6
const recommended = (a: WorkflowWorkshopModel, b: WorkflowWorkshopModel) =>
  (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity) ||
  (a.categoryOrder ?? Infinity) - (b.categoryOrder ?? Infinity)
const ordered = computed(() =>
  sort.value === 'name'
    ? sortWorkshopModels(models, 'name')
    : [...models].sort(recommended)
)
// Each category's highlight leads, then the rest in recommended order.
const popular = computed(() =>
  sort.value === 'name'
    ? ordered.value
    : [...ordered.value].sort(
        (a, b) => Number(!a.categoryHighlight) - Number(!b.categoryHighlight)
      )
)
const shelves = computed(() =>
  [
    {
      id: 'popular',
      label: t('hubPages.workflows.popular'),
      models: popular.value.slice(0, POPULAR_LIMIT)
    },
    {
      id: 'image',
      label: t('hubPages.workflows.image'),
      models: ordered.value.filter((model) => model.modality === 'image')
    },
    {
      id: 'video',
      label: t('hubPages.workflows.video'),
      models: ordered.value.filter((model) => model.modality === 'video')
    }
  ].filter((shelf) => shelf.models.length)
)

// What narrowed the list stays legible next to it, so a reader can take one
// choice off without reopening the menu that made it.
const chips = computed<FilterChip[]>(() => [
  ...selected.value.map((id) => ({
    key: `use:${id}`,
    label: options.value.find((option) => option.value === id)?.label ?? id
  })),
  ...runsOn.value.map((name) => ({
    key: `model:${name}`,
    label: t('workshop.filter.runsOn', { model: name })
  }))
])

function removeChip(key: string) {
  const [kind, ...rest] = key.split(':')
  const value = rest.join(':')
  if (kind === 'use')
    selected.value = selected.value.filter((id) => id !== value)
  else runsOn.value = runsOn.value.filter((name) => name !== value)
}

function clearFilters() {
  selected.value = []
  runsOn.value = []
}

function clear() {
  query.value = ''
  clearFilters()
}
</script>

<template>
  <section data-testid="workflow-catalogue">
    <div
      :id="HUB_TOOLBAR_ID"
      class="sticky top-20 z-30 -mx-1 mb-8 flex flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:mb-4 max-sm:py-2 lg:top-26"
      data-testid="workshop-toolbar"
    >
      <div
        class="flex min-w-0 flex-1 items-center gap-3 max-sm:basis-full sm:min-w-fit"
      >
        <WorkshopSearchField
          v-model="query"
          :models="matchingCategories"
          :locale
          kind="workflows"
          compact
          class="min-w-0 flex-1"
        />
        <WorkshopFilterMenu
          ref="filterMenu"
          v-model:use-cases="selected"
          v-model:models="runsOn"
          kind="workflows"
          :use-case-options="options"
          :model-options="modelOptions"
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

    <WorkshopFilterChips
      :chips
      :locale
      @remove="removeChip"
      @clear="clearFilters"
      @emptied="filterMenu?.focus()"
    />

    <div v-if="browsing" class="flex flex-col gap-14">
      <section
        v-for="shelf in shelves"
        :key="shelf.id"
        :aria-labelledby="`workflow-shelf-${shelf.id}`"
        :data-testid="`workflow-shelf-${shelf.id}`"
      >
        <CardRow :locale>
          <template #heading>
            <h2
              :id="`workflow-shelf-${shelf.id}`"
              class="text-xl font-medium text-primary-warm-white"
            >
              {{ shelf.label }}
            </h2>
          </template>
          <li
            v-for="model in shelf.models"
            :key="model.slug"
            :class="SHELF_CARD"
          >
            <WorkshopModelCard :model :locale />
          </li>
        </CardRow>
      </section>
    </div>

    <ul
      v-else-if="visible.length"
      :class="CARD_GRID"
      :aria-label="t('workshop.hub.workflows')"
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
        {{ t('workshop.catalogue.noWorkflows') }}
      </p>
      <Button variant="outline" size="sm" @click="clear">
        {{ t('workshop.empty.clear') }}
      </Button>
    </div>
  </section>
</template>
