<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'

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
import { useAddressedChoice } from '@/lib/workshop/addressed-choice'
import { matchesSectionName } from '@/lib/workshop/workflow-goals'
import {
  HUB_TAXONOMY,
  MODALITY_TASK_KEYS,
  collectionChips,
  inCollection,
  inModalityTask,
  modalityTaskChoices,
  modalityTaskShown
} from '@/lib/workshop/workflow-modality-tasks'
import { WORKFLOW_COLLECTIONS } from '@/lib/workshop/workflow-catalogue-mock-data'
import type { WorkflowCatalogueMock } from '@/lib/workshop/workflow-catalogue-mock'
import { fetchWorkflowCatalogueMock } from '@/lib/workshop/workflow-catalogue-mock'
import { usePreviewSwitch } from '@/lib/workshop/preview-switches'
import { modelSlides } from '@/lib/workshop/featured-slides'
import CatalogueHero from './CatalogueHero.vue'
import FeaturedBanner from './FeaturedBanner.vue'
import type { FeaturedSlide } from './FeaturedBanner.vue'
import CatalogueShowMore from './CatalogueShowMore.vue'
import HubChoiceSidebar from './HubChoiceSidebar.vue'
import WorkflowCategoryTabs from './WorkflowCategoryTabs.vue'
import WorkflowCollectionChips from './WorkflowCollectionChips.vue'
import type { FacetMenuOption } from './WorkshopFilterMenu.vue'
import WorkshopFilterMenu from './WorkshopFilterMenu.vue'
import WorkflowSectionRows from './WorkflowSectionRows.vue'
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

const language = locale === 'zh-CN' ? locale : 'en'
const categories = computed(() => workflowCategories(models, language))
const featuredSlides = computed(() =>
  modelSlides(
    models.filter((model) => model.categoryHighlight),
    locale
  )
)
function openFeatured(slide: FeaturedSlide, position: number) {
  captureHubItemClick(
    { kind: 'workflow', slug: slide.key },
    { surface: 'workflows', source: 'featured_banner', position }
  )
}
const modalityTaskOn = usePreviewSwitch('hub-workflows-modality-task')
const mockSwitch = usePreviewSwitch('hub-workflows-full-catalogue-mock')
const mockOn = computed(() => modalityTaskOn.value && mockSwitch.value)
const mock = shallowRef<WorkflowCatalogueMock>()
const catalogue = computed(() =>
  mockOn.value ? (mock.value?.models ?? []) : models
)
const taxonomy = computed(() =>
  mockOn.value && mock.value ? mock.value.taxonomy : HUB_TAXONOMY
)
const sidebarWidth = computed(() =>
  modalityTaskOn.value ? 'lg:w-58' : 'lg:w-70'
)
const { choice: modalityTask, readAddress: readModalityTask } =
  useAddressedChoice('browse', MODALITY_TASK_KEYS, modalityTaskOn, (key) =>
    modalityTaskShown(catalogue.value, key, taxonomy.value)
  )
const modalityTaskEntries = computed(() =>
  modalityTaskChoices(catalogue.value, modalityTask.value, t, taxonomy.value)
)
const { choice: collection, readAddress: readCollection } = useAddressedChoice(
  'collection',
  WORKFLOW_COLLECTIONS,
  modalityTaskOn,
  (key) =>
    catalogue.value.some((model) => inCollection(model, key, taxonomy.value))
)
const panelTab = computed(() =>
  modalityTaskOn.value ? modalityTask.value : category.value
)

function knownMedia(values: readonly string[]): Modality[] {
  return MODALITIES.filter((media) => values.includes(media))
}

const { submitSearch, quietly } = useHubCatalogueTracking('workflows', {
  query,
  resultsCount: () => visible.value.length,
  filters: [
    ['category', () => category.value],
    ['type', () => modalityTask.value],
    ['collection', () => collection.value],
    ['model', () => runsOn.value],
    ['sort', () => sort.value]
  ]
})
watch(modalityTaskOn, (on) => {
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
    category.value = modalityTaskOn.value
      ? ALL_WORKFLOWS
      : categoryFromAddress(search, models)
    readModalityTask(search)
    readCollection(search)
    inputs.value = knownMedia(params.getAll('input'))
    outputs.value = modalityTaskOn.value
      ? []
      : knownMedia(params.getAll('output'))
    runsOn.value = params
      .getAll('model')
      .filter((name) => models.some((model) => model.models?.includes(name)))
    scrollToSection(
      sectionFromHash(location.hash, models) ??
        sectionFromAddress(search, models)
    )
    void loadMock()
  })
)

async function loadMock() {
  if (!mockOn.value || mock.value) return
  mock.value = await fetchWorkflowCatalogueMock()
  quietly(() => {
    readModalityTask(location.search)
    readCollection(location.search)
  })
}
watch(mockOn, () => void loadMock())

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

function openCard(event: MouseEvent, model: WorkshopModel, position: number) {
  if (mockOn.value) event.preventDefault()
  else openWorkflow(model, position)
}

watch(category, (value) => {
  const next = categoryAddress(location.href, value)
  if (next !== location.href) history.replaceState(history.state, '', next)
})

const ordered = computed(() =>
  [...catalogue.value].sort(
    (a, b) =>
      (a.categoryOrder ?? Infinity) - (b.categoryOrder ?? Infinity) ||
      (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity)
  )
)
const byModalityTask = computed(() =>
  ordered.value.filter((model) =>
    inModalityTask(model, modalityTask.value, taxonomy.value)
  )
)
const collectionEntries = computed(() =>
  modalityTaskOn.value
    ? collectionChips(byModalityTask.value, t, taxonomy.value)
    : []
)
const toolbarSpacing = computed(() =>
  collectionEntries.value.length ? 'mb-0' : 'mb-8 max-sm:mb-4'
)
watch(collectionEntries, (entries) => {
  if (!entries.some((entry) => entry.key === collection.value))
    collection.value = 'all'
})
const inCategory = computed(() =>
  modalityTaskOn.value
    ? byModalityTask.value.filter((model) =>
        inCollection(model, collection.value, taxonomy.value)
      )
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
  modalityTaskOn.value
    ? []
    : mediaOptions(
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
  () =>
    new Set([
      ...searchWorkshopModels(catalogue.value, { query: query.value }),
      ...(modalityTaskOn.value
        ? models.filter((model) => matchesSectionName(model, query.value))
        : []),
      ...(mockOn.value && mock.value
        ? catalogue.value.filter((model) =>
            mock.value?.matches(model, query.value)
          )
        : [])
    ])
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
    !modalityTaskOn.value &&
    !query.value.trim() &&
    allSectioned(models) &&
    visible.value.length > 0
)
const sections = computed(() => workflowSections(visible.value, language))

function clearFilters() {
  inputs.value = []
  outputs.value = []
  runsOn.value = []
}

function clear() {
  query.value = ''
  category.value = ALL_WORKFLOWS
  modalityTask.value = 'all'
  collection.value = 'all'
  clearFilters()
}
</script>

<template>
  <CatalogueHero
    :title="t('workshop.hub.workflows')"
    :subtitle="t('workshop.catalogue.workflowsSubtitle')"
    :features="[]"
    :features-label="t('workshop.featured.workflowsLabel')"
    :locale
    data-testid="workflows-hub-hero"
  />
  <FeaturedBanner
    v-if="featuredSlides.length"
    :slides="featuredSlides"
    :locale
    :autoplay="false"
    class="mb-8 short:mb-4"
    @open="openFeatured"
  />
  <section
    class="flex flex-col lg:flex-row lg:items-start lg:gap-10"
    data-testid="workflow-catalogue"
  >
    <div
      :class="
        cn('max-lg:contents lg:sticky lg:top-26 lg:shrink-0', sidebarWidth)
      "
    >
      <HubChoiceSidebar
        v-if="modalityTaskOn"
        v-model="modalityTask"
        :entries="modalityTaskEntries"
        :label="t('workshop.taskSidebar.typeLabel')"
        :panel-id="TAB_PANEL_ID"
        class="max-lg:order-1 max-lg:mb-1 max-sm:mb-1"
      />
      <WorkflowCategoryTabs
        v-else
        v-model="category"
        :categories
        :total="models.length"
        :panel-id="TAB_PANEL_ID"
        :locale
        class="max-lg:order-1"
      />
    </div>

    <div class="min-w-0 max-lg:contents lg:flex-1">
      <div
        :id="HUB_TOOLBAR_ID"
        :class="
          cn(
            'sticky top-20 z-30 -mx-1 flex flex-wrap items-center gap-3 bg-page px-1 py-4 max-sm:py-2 lg:top-26',
            toolbarSpacing
          )
        "
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
            v-model:inputs="inputs"
            v-model:outputs="outputs"
            v-model:models="runsOn"
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
        :aria-labelledby="`${TAB_PANEL_ID}-${panelTab}`"
        class="max-lg:order-2"
      >
        <WorkflowCollectionChips
          v-model="collection"
          :chips="collectionEntries"
          :label="t('workshop.workflowCollections.label')"
        />

        <WorkflowSectionRows
          v-if="sectioned"
          :sections
          :locale
          @open="openWorkflow"
        />
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
                @click="openCard($event, model, index)"
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
