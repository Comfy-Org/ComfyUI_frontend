<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { ComponentExposed } from 'vue-component-type-helpers'

import Button from '@/components/ui/button/Button.vue'
import type {
  Modality,
  SortOrder,
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import { MODALITIES, sortWorkshopModels } from '@/config/models-catalogue'
import { searchWorkshopModels } from '@/config/models-search'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { usePagedList } from '@/composables/usePagedList'
import { HUB_TOOLBAR_ID } from '@/scripts/hubToolbar'
import { useHubCatalogueTracking } from '@/composables/useHubCatalogueTracking'
import {
  captureHubItemClick,
  hubActiveQuery,
  hubItemOf
} from '@/scripts/hub-analytics'
import { CARD_GRID_BESIDE_NAV } from '@/lib/workshop/card-layout'
import {
  ALL_WORKFLOWS,
  categoryAddress,
  categoryFromAddress,
  workflowCategories
} from '@/lib/workshop/workflow-categories'
import {
  allSectioned,
  sectionAnchor,
  sectionFromAddress,
  sectionFromHash,
  workflowSections
} from '@/lib/workshop/workflow-sections'
import { useHubTaskSelection } from '@/lib/workshop/hub-task-address'
import {
  hubTaskEntries,
  hubTaskShown,
  inHubTask
} from '@/lib/workshop/hub-tasks'
import { usePreviewSwitch } from '@/lib/workshop/preview-switches'
import CatalogueShowMore from './CatalogueShowMore.vue'
import HubTaskSidebar from './HubTaskSidebar.vue'
import WorkflowCategoryTabs from './WorkflowCategoryTabs.vue'
import type { FilterChip } from './WorkshopFilterChips.vue'
import WorkshopFilterChips from './WorkshopFilterChips.vue'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
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

const TAB_PANEL_ID = 'workflow-category-panel'
const query = ref('')
const category = ref(ALL_WORKFLOWS)
const inputs = ref<Modality[]>([])
const outputs = ref<Modality[]>([])
const runsOn = ref<string[]>([])
const sort = ref<SortOrder>('popular')
const filterMenu =
  useTemplateRef<ComponentExposed<typeof WorkshopFilterMenu>>('filterMenu')

const language = locale === 'zh-CN' ? locale : 'en'
const categories = computed(() => workflowCategories(models, language))
const taskSidebar = usePreviewSwitch('hub-task-sidebar')
const taskEntries = computed(() =>
  hubTaskEntries(models, (listed) => listed.length)
)
const { taskKey, readAddress: readTask } = useHubTaskSelection(
  taskSidebar,
  (key) => hubTaskShown(taskEntries.value, key)
)

function knownMedia(values: readonly string[]): Modality[] {
  return MODALITIES.filter((media) => values.includes(media))
}

const { submitSearch, quietly } = useHubCatalogueTracking('workflows', {
  query,
  resultsCount: () => visible.value.length,
  filters: [
    ['category', () => category.value],
    ['task', () => taskKey.value],
    ['model', () => runsOn.value],
    ['sort', () => sort.value]
  ]
})
watch(taskSidebar, (on) => {
  if (on) quietly(() => (category.value = ALL_WORKFLOWS))
})
function scrollToSection(id: string | undefined) {
  if (!id) return
  void nextTick(() =>
    document.getElementById(sectionAnchor(id))?.scrollIntoView()
  )
}

onMounted(() =>
  quietly(() => {
    const search = initialSearch ?? location.search
    const params = new URLSearchParams(search)
    query.value = params.get('q') ?? ''
    category.value = taskSidebar.value
      ? ALL_WORKFLOWS
      : categoryFromAddress(search, models)
    readTask(search)
    inputs.value = knownMedia(params.getAll('input'))
    outputs.value = knownMedia(params.getAll('output'))
    runsOn.value = params
      .getAll('model')
      .filter((name) => models.some((model) => model.models?.includes(name)))
    scrollToSection(
      sectionFromHash(location.hash, models) ??
        sectionFromAddress(search, models)
    )
  })
)

function openWorkflow(model: WorkshopModel, position: number, row?: string) {
  submitSearch()
  captureHubItemClick(hubItemOf(model), {
    surface: 'workflows',
    source: 'results_grid',
    position,
    ...(row && { row }),
    ...hubActiveQuery(query.value)
  })
}

watch(category, (value) => {
  const next = categoryAddress(location.href, value)
  if (next !== location.href) history.replaceState(history.state, '', next)
})

const ordered = computed(() =>
  [...models].sort(
    (a, b) =>
      (a.categoryOrder ?? Infinity) - (b.categoryOrder ?? Infinity) ||
      (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity)
  )
)
const inCategory = computed(() =>
  taskSidebar.value
    ? ordered.value.filter((model) => inHubTask(model, taskKey.value))
    : category.value === ALL_WORKFLOWS
      ? ordered.value
      : ordered.value.filter((model) => model.category === category.value)
)

function startsFrom(model: WorkflowWorkshopModel, chosen: Modality[]) {
  return (
    !chosen.length ||
    (model.inputKinds ?? []).some((media) => chosen.includes(media))
  )
}
function makes(model: WorkflowWorkshopModel, chosen: Modality[]) {
  return !chosen.length || (!!model.modality && chosen.includes(model.modality))
}
function runsOnChosen(model: WorkflowWorkshopModel, chosen: string[]) {
  return !chosen.length || !!model.models?.some((name) => chosen.includes(name))
}

// A choice that every listed workflow shares narrows nothing, so it is only
// offered while it would change the list or is already chosen.
function mediaOptions(
  list: readonly WorkflowWorkshopModel[],
  mediaOf: (model: WorkflowWorkshopModel) => readonly Modality[],
  chosen: readonly Modality[]
): FacetMenuOption<Modality>[] {
  return MODALITIES.map((value) => ({
    value,
    label: t(`workshop.filter.${value}`),
    count: list.filter((model) => mediaOf(model).includes(value)).length
  })).filter(
    (option) =>
      chosen.includes(option.value) ||
      (option.count > 0 && option.count < list.length)
  )
}

const inputOptions = computed(() =>
  mediaOptions(
    inCategory.value.filter(
      (model) =>
        makes(model, outputs.value) && runsOnChosen(model, runsOn.value)
    ),
    (model) => model.inputKinds ?? [],
    inputs.value
  )
)
const outputOptions = computed(() =>
  mediaOptions(
    inCategory.value.filter(
      (model) =>
        startsFrom(model, inputs.value) && runsOnChosen(model, runsOn.value)
    ),
    (model) => (model.modality ? [model.modality] : []),
    outputs.value
  )
)
// An outcome is reached through the model it runs on as often as through the
// task it performs, and one workflow can stand on several.
const modelOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const model of inCategory.value)
    for (const name of model.models ?? [])
      counts.set(name, (counts.get(name) ?? 0) + 1)
  return [...counts]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
})

const matching = computed(() =>
  inCategory.value.filter(
    (model) =>
      startsFrom(model, inputs.value) &&
      makes(model, outputs.value) &&
      runsOnChosen(model, runsOn.value)
  )
)
const searched = computed(
  () => new Set(searchWorkshopModels(models, { query: query.value }))
)
const visible = computed(() => {
  const found = matching.value.filter((model) => searched.value.has(model))
  return sort.value === 'popular'
    ? found
    : sortWorkshopModels(found, sort.value)
})
const { shown, total, hasMore, showMore } = usePagedList(visible)

const sectioned = computed(
  () =>
    !query.value.trim() &&
    (!taskSidebar.value || taskKey.value === 'all') &&
    allSectioned(models) &&
    visible.value.length > 0
)
const sections = computed(() => workflowSections(visible.value, language))

// What narrowed the list stays legible next to it, so a reader can take one
// choice off without reopening the menu that made it.
const chips = computed<FilterChip[]>(() => [
  ...inputs.value.map((media) => ({
    key: `input:${media}`,
    label: t('workshop.filter.inputChip', {
      media: t(`workshop.filter.${media}`)
    })
  })),
  ...outputs.value.map((media) => ({
    key: `output:${media}`,
    label: t('workshop.filter.outputChip', {
      media: t(`workshop.filter.${media}`)
    })
  })),
  ...runsOn.value.map((name) => ({
    key: `model:${name}`,
    label: t('workshop.filter.runsOn', { model: name })
  }))
])

function removeChip(key: string) {
  const [kind, ...rest] = key.split(':')
  const value = rest.join(':')
  if (kind === 'input')
    inputs.value = inputs.value.filter((media) => media !== value)
  else if (kind === 'output')
    outputs.value = outputs.value.filter((media) => media !== value)
  else runsOn.value = runsOn.value.filter((name) => name !== value)
}

function clearFilters() {
  inputs.value = []
  outputs.value = []
  runsOn.value = []
}

function clear() {
  query.value = ''
  category.value = ALL_WORKFLOWS
  taskKey.value = 'all'
  clearFilters()
}
</script>

<template>
  <section
    class="flex flex-col lg:flex-row lg:items-start lg:gap-10"
    data-testid="workflow-catalogue"
  >
    <div class="max-lg:contents lg:sticky lg:top-26 lg:w-70 lg:shrink-0">
      <HubTaskSidebar
        v-if="taskSidebar"
        v-model="taskKey"
        :entries="taskEntries"
        :total="models.length"
        :panel-id="TAB_PANEL_ID"
        :locale
        class="max-lg:order-1"
        data-design-decision="workflows-sidebar"
      />
      <WorkflowCategoryTabs
        v-else
        v-model="category"
        :categories
        :total="models.length"
        :panel-id="TAB_PANEL_ID"
        :locale
        class="max-lg:order-1"
        data-design-decision="workflows-sidebar"
      />
    </div>

    <div class="min-w-0 max-lg:contents lg:flex-1">
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
            :models="matching"
            :locale
            kind="workflows"
            compact
            class="min-w-0 flex-1"
            @submit="submitSearch"
          />
          <WorkshopFilterMenu
            ref="filterMenu"
            v-model:inputs="inputs"
            v-model:outputs="outputs"
            v-model:models="runsOn"
            data-design-decision="workflows-filters"
            kind="workflows"
            :input-options
            :output-options
            :model-options
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

      <div
        :id="TAB_PANEL_ID"
        role="tabpanel"
        :aria-labelledby="`${TAB_PANEL_ID}-${taskSidebar ? taskKey : category}`"
        class="max-lg:order-2"
      >
        <WorkshopFilterChips
          :chips
          :locale
          @remove="removeChip"
          @clear="clearFilters"
          @emptied="filterMenu?.focus()"
        />

        <div v-if="sectioned" class="flex flex-col gap-12">
          <section
            v-for="section in sections"
            :id="sectionAnchor(section.id)"
            :key="section.id"
            :aria-labelledby="`${sectionAnchor(section.id)}-heading`"
            class="scroll-mt-44 lg:scroll-mt-52"
            :data-testid="`workflow-section-${section.id}`"
          >
            <h2
              :id="`${sectionAnchor(section.id)}-heading`"
              class="mb-5 text-xl font-medium text-primary-warm-white"
            >
              {{ section.label }}
            </h2>
            <ul
              :class="CARD_GRID_BESIDE_NAV"
              :aria-label="section.label"
              data-testid="workflow-grid"
            >
              <li v-for="(model, index) in section.models" :key="model.slug">
                <WorkshopModelCard
                  :model
                  :locale
                  @click="openWorkflow(model, index, section.id)"
                />
              </li>
            </ul>
          </section>
        </div>
        <template v-else-if="visible.length">
          <ul
            :class="CARD_GRID_BESIDE_NAV"
            :aria-label="t('workshop.hub.workflows')"
            data-testid="workflow-grid"
          >
            <li v-for="(model, index) in shown" :key="model.slug">
              <WorkshopModelCard
                :model
                :locale
                @click="openWorkflow(model, index)"
              />
            </li>
          </ul>
          <CatalogueShowMore
            v-if="hasMore"
            :shown="shown.length"
            :total
            :locale
            @more="showMore"
          />
        </template>
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
      </div>
    </div>
  </section>
</template>
