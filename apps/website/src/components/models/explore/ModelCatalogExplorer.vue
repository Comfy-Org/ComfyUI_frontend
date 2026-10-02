<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { cn } from '@comfyorg/tailwind-utils'

import ModelExploreGrid from './ModelExploreGrid.vue'
import type { CardWorkflowItem } from './ModelExploreCard.vue'
import ModelCollectionHeader from './ModelCollectionHeader.vue'
import SearchField from './ModelSearchField.vue'
import type { ModelCategory } from '../../../config/modelCategories'
import { deriveModelCategories } from '../../../config/modelCategories'

import ModelCategoryFilter from './ModelCategoryFilter.vue'
import type {
  ModelCatalogFilterValue,
  ModelCategoryOption
} from './ModelCategoryFilter.vue'
import type {
  ExploreModelCardFixture,
  ExploreModelStatus
} from './modelExploreFixtures'
import { filterModelExploreCatalog } from './modelExploreCatalog'
import type {
  ModelAccessFilter,
  ModelExploreCatalogItem
} from './modelExploreCatalog'

const {
  catalog,
  pageSize = 8,
  catalogCardVariant = 'compact',
  catalogCardModels = [],
  categoryOptions,
  categoryLabel,
  searchLabel,
  searchPlaceholder,
  workflowCountOne,
  workflowCountMany,
  partnerLabel,
  resultCountLabel,
  emptyLabel,
  trendingEmptyLabel,
  latestEmptyLabel,
  showMoreLabel,
  showCatalogByDefault = false,
  showCatalogOnFilter = true,
  catalogLabel,
  defaultModels,
  latestCollection,
  collectionHeadingId,
  collectionLabel,
  collectionDescription,
  collectionActionLabel,
  collectionActionHref,
  openWeightsBadgeLabel
} = defineProps<{
  catalog: ModelExploreCatalogItem[]
  pageSize?: number
  catalogCardVariant?: 'compact' | 'hub'
  catalogCardModels?: ExploreModelCardFixture[]
  categoryOptions: ModelCategoryOption[]
  categoryLabel: string
  searchLabel: string
  searchPlaceholder: string
  workflowCountOne: string
  workflowCountMany: string
  partnerLabel: string
  resultCountLabel: string
  emptyLabel: string
  trendingEmptyLabel?: string
  latestEmptyLabel?: string
  showMoreLabel: string
  showCatalogByDefault?: boolean
  showCatalogOnFilter?: boolean
  catalogLabel?: string
  defaultModels?: ExploreModelCardFixture[]
  latestCollection?: {
    models: ExploreModelCardFixture[]
    headingId: string
    label: string
    description: string
  }
  collectionHeadingId?: string
  collectionLabel?: string
  collectionDescription?: string
  collectionActionLabel?: string
  collectionActionHref?: string
  openWeightsBadgeLabel?: string
}>()

const resultsClass = computed(() =>
  cn(
    'mx-auto max-w-10xl px-6 md:px-10 xl:px-30',
    defaultModels ? 'pt-14 pb-8' : 'pt-8 pb-4'
  )
)

const RESULTS_PER_PAGE = pageSize
const visibleCount = ref(RESULTS_PER_PAGE)
const searchQuery = ref('')
const query = computed({
  get: () => searchQuery.value,
  set: (value: string) => {
    searchQuery.value = value
    visibleCount.value = RESULTS_PER_PAGE
    syncUrl(true)
  }
})
const category = ref<'all' | ModelCategory>('all')
const access = ref<ModelAccessFilter>('all')
const filterSelection = computed<ModelCatalogFilterValue>({
  get: () => (access.value === 'all' ? category.value : access.value),
  set: (selection) => {
    visibleCount.value = RESULTS_PER_PAGE
    if (selection === 'open' || selection === 'partner') {
      access.value = selection
      category.value = 'all'
      syncUrl()
      return
    }

    category.value = selection
    access.value = 'all'
    syncUrl()
  }
})
const showAll = ref(showCatalogByDefault)
const latestOnly = ref(false)
const trendingExpanded = ref(false)
const isActive = computed(
  () =>
    showCatalogOnFilter &&
    !latestOnly.value &&
    (showAll.value ||
      (showCatalogOnFilter &&
        (query.value.trim().length > 0 ||
          category.value !== 'all' ||
          access.value !== 'all')))
)
const filteredCatalog = computed(() =>
  filterModelExploreCatalog(catalog, query.value, category.value, access.value)
)
const isEmpty = computed(
  () => isActive.value && filteredCatalog.value.length === 0
)
const displayedCatalog = computed(() =>
  filteredCatalog.value.slice(0, visibleCount.value)
)
const hasMoreResults = computed(
  () => visibleCount.value < filteredCatalog.value.length
)
const resultStatus = computed(() =>
  isActive.value
    ? resultCountLabel.replace('{count}', String(filteredCatalog.value.length))
    : ''
)
const categoryLabels = computed(
  () =>
    new Map(
      categoryOptions.map((option) => [option.value, option.label] as const)
    )
)

function syncUrl(replace = false) {
  const url = new URL(window.location.href)
  if (!showCatalogOnFilter) {
    url.searchParams.delete('catalog')
    url.searchParams.delete('view')
    if (url.hash === '#model-catalog-results') url.hash = ''
  }
  for (const key of ['category', 'access', 'q']) url.searchParams.delete(key)
  if (category.value !== 'all') url.searchParams.set('category', category.value)
  if (access.value !== 'all') url.searchParams.set('access', access.value)
  if (query.value.trim()) url.searchParams.set('q', query.value.trim())
  if (url.href === window.location.href) return
  if (replace) window.history.replaceState({}, '', url)
  else window.history.pushState({}, '', url)
}
function readUrl() {
  const params = new URLSearchParams(window.location.search)
  const accessParam = params.get('access')
  const categoryParam = categoryOptions.find(
    (option) => option.value === params.get('category')
  )?.value
  access.value =
    accessParam === 'open' || accessParam === 'partner' ? accessParam : 'all'
  category.value =
    access.value === 'all' &&
    categoryParam &&
    categoryParam !== 'open' &&
    categoryParam !== 'partner'
      ? categoryParam
      : 'all'
  searchQuery.value = params.get('q') ?? ''
  latestOnly.value =
    Boolean(latestCollection) && params.get('collection') === 'latest'
  trendingExpanded.value = params.get('collection') === 'trending'
  showAll.value =
    !latestOnly.value &&
    (showCatalogByDefault ||
      params.get('catalog') === 'all' ||
      params.get('view') === 'all')
  visibleCount.value = RESULTS_PER_PAGE
  if (!showCatalogOnFilter) syncUrl(true)
}
useEventListener('popstate', readUrl)
onMounted(async () => {
  readUrl()
  if (window.location.hash) {
    await nextTick()
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
  }
})
function collectionHref(latest = false) {
  if (!collectionActionHref) return undefined
  const url = new URL(collectionActionHref, 'https://comfy.org')
  url.searchParams.delete('catalog')
  url.searchParams.delete('collection')
  if (url.pathname.endsWith('/all/')) {
    url.hash = ''
  } else if (latest) {
    url.searchParams.set('collection', 'latest')
    url.hash = latestCollection?.headingId ?? ''
  } else {
    url.searchParams.set('collection', 'trending')
    url.hash = 'trending-models'
  }
  if (category.value !== 'all') url.searchParams.set('category', category.value)
  if (access.value !== 'all') url.searchParams.set('access', access.value)
  if (query.value.trim()) url.searchParams.set('q', query.value.trim())
  return `${url.pathname}${url.search}${url.hash}`
}

function workflowDescription(workflowCount: number): string {
  return (workflowCount === 1 ? workflowCountOne : workflowCountMany).replace(
    '{count}',
    String(workflowCount)
  )
}

function toWorkflowItem(model: ModelExploreCatalogItem): CardWorkflowItem {
  const categoryTags = model.categories
    .slice(0, 2)
    .map((modelCategory) => categoryLabels.value.get(modelCategory))
    .filter((label): label is string => label !== undefined)
  if (catalogCardVariant === 'hub') {
    const fixture = catalogCardModels.find(
      (entry) =>
        entry.href.replace(/\/$/, '') === model.href.replace(/\/$/, '') ||
        entry.name.toLowerCase() === model.title.toLowerCase()
    )
    if (fixture)
      return {
        ...toDefaultWorkflowItem(fixture),
        id: model.slug,
        href: model.href,
        taskLabel: fixture.taskLabel ?? categoryTags[0],
        description: undefined,
        media: model.thumbnailUrl
          ? { type: 'image', src: model.thumbnailUrl, alt: '' }
          : toDefaultWorkflowItem(fixture).media
      }
    return {
      id: model.slug,
      title: model.title,
      href: model.href,
      target: '_self',
      provider: model.title,
      taskLabel: categoryTags[0],
      capabilities: categoryTags.slice(1),
      statusBadges:
        model.directory !== 'partner_nodes' && openWeightsBadgeLabel
          ? [{ type: 'open-weights', label: openWeightsBadgeLabel }]
          : [],
      media: model.thumbnailUrl
        ? { type: 'image', src: model.thumbnailUrl, alt: '' }
        : { type: 'placeholder', alt: '' }
    }
  }
  return {
    id: model.slug,
    title: model.title,
    href: model.href,
    target: '_self',
    description: workflowDescription(model.workflowCount),
    tags:
      model.directory === 'partner_nodes'
        ? [partnerLabel, ...categoryTags]
        : categoryTags,
    media: model.thumbnailUrl
      ? { type: 'image', src: model.thumbnailUrl, alt: '' }
      : { type: 'placeholder', alt: '' }
  }
}

const statusLabels = computed<Partial<Record<ExploreModelStatus, string>>>(
  () => (openWeightsBadgeLabel ? { 'open-weights': openWeightsBadgeLabel } : {})
)

function toDefaultWorkflowItem(
  model: ExploreModelCardFixture
): CardWorkflowItem {
  return {
    id: model.name,
    title: model.name,
    provider: model.provider,
    taskLabel: model.taskLabel,
    capabilities: model.capabilities,
    href: model.href,
    target: model.target,
    description: model.description,
    statusBadges: model.statuses?.flatMap((type) => {
      const label = statusLabels.value[type]
      return label ? [{ type, label }] : []
    }),
    tags: [
      model.modality,
      ...(model.statuses?.includes('open-weights') ? [] : [model.tag])
    ],
    media:
      model.media.type === 'image'
        ? { type: 'image', src: model.media.src, alt: '' }
        : { type: 'placeholder', alt: '' }
  }
}
const displayEntries = computed(() =>
  displayedCatalog.value.map((model) => ({
    item: toWorkflowItem(model),
    tone: model.mediaTone
  }))
)
function collectionEntries(models: ExploreModelCardFixture[]) {
  const sections: Record<string, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    '3d': '3D Model',
    llm: 'LLM'
  }
  const filterableModels = models.map((model) => ({
    model,
    categories: deriveModelCategories(
      sections[model.modality] ?? '',
      model.capabilities ?? []
    ).filter(
      (value) =>
        value === model.modality || value === 'edit' || value === 'upscale'
    ),
    directory: model.statuses?.includes('open-weights')
      ? ('diffusion_models' as const)
      : ('partner_nodes' as const),
    searchText: [
      model.name,
      model.provider,
      model.description,
      model.modality,
      model.taskLabel,
      ...(model.capabilities ?? [])
    ]
      .join(' ')
      .toLowerCase()
  }))
  return filterModelExploreCatalog(
    filterableModels,
    query.value,
    category.value,
    access.value
  ).map(({ model }) => ({
    item: toDefaultWorkflowItem(model),
    releasedAt: model.releasedAt ?? model.supportedAt,
    tone:
      model.media.type === 'placeholder' ? model.media.tone : ('plum' as const)
  }))
}
const defaultEntries = computed(() => collectionEntries(defaultModels ?? []))
const latestEntries = computed(() =>
  collectionEntries(latestCollection?.models ?? []).sort((a, b) =>
    (b.releasedAt ?? '').localeCompare(a.releasedAt ?? '')
  )
)
</script>

<template>
  <section class="mx-auto max-w-10xl px-6 py-8 md:px-10 xl:px-30">
    <SearchField
      v-model="query"
      :label="searchLabel"
      :placeholder="searchPlaceholder"
      :status="resultStatus"
    />
  </section>
  <div class="mx-auto max-w-10xl overflow-x-auto px-6 py-3 md:px-10 xl:px-30">
    <ModelCategoryFilter
      v-model="filterSelection"
      :label="categoryLabel"
      :categories="categoryOptions"
    />
  </div>
  <section
    v-if="defaultModels && !isActive"
    id="trending-models"
    :aria-labelledby="collectionHeadingId"
    :class="resultsClass"
  >
    <ModelCollectionHeader
      :heading-id="collectionHeadingId"
      :label="collectionLabel"
      :description="collectionDescription"
      :action-label="collectionActionLabel"
      :action-href="collectionHref()"
    />
    <p
      v-if="!defaultEntries.length"
      class="py-4 text-center text-base font-light text-content-secondary"
    >
      {{ trendingEmptyLabel ?? emptyLabel }}
    </p>
    <ModelExploreGrid
      v-else
      :entries="trendingExpanded ? defaultEntries : defaultEntries.slice(0, 8)"
      variant="hub"
      class="mt-7"
    />
  </section>
  <section
    v-if="isActive"
    id="model-catalog-results"
    :aria-labelledby="catalogLabel ? 'model-catalog-heading' : undefined"
    :class="resultsClass"
  >
    <ModelCollectionHeader
      v-if="catalogLabel"
      heading-id="model-catalog-heading"
      :label="catalogLabel"
    />
    <p
      v-if="isEmpty"
      class="py-4 text-center text-base font-light text-content-secondary"
    >
      {{ emptyLabel }}
    </p>
    <ModelExploreGrid
      v-else
      :entries="displayEntries"
      :variant="catalogCardVariant"
      :class="cn(catalogLabel && 'mt-7')"
    />
    <div v-if="hasMoreResults" class="mt-8 flex justify-center">
      <button
        type="button"
        class="inline-flex h-10 cursor-pointer items-center justify-center rounded-2xl border border-brand px-12 text-sm font-semibold tracking-wider text-brand uppercase transition-colors hover:bg-brand hover:text-page"
        @click="visibleCount += RESULTS_PER_PAGE"
      >
        {{ showMoreLabel }}
      </button>
    </div>
  </section>
  <section
    v-if="latestCollection && !isActive"
    :aria-labelledby="latestCollection.headingId"
    class="mx-auto max-w-10xl px-6 pt-14 pb-8 md:px-10 xl:px-30"
  >
    <ModelCollectionHeader
      :heading-id="latestCollection.headingId"
      :label="latestCollection.label"
      :description="latestCollection.description"
      :action-label="collectionActionLabel"
      :action-href="collectionHref(true)"
    />
    <p
      v-if="!latestEntries.length"
      class="py-4 text-center text-base font-light text-content-secondary"
    >
      {{ latestEmptyLabel ?? emptyLabel }}
    </p>
    <ModelExploreGrid
      v-else
      :entries="latestOnly ? latestEntries : latestEntries.slice(0, 4)"
      variant="hub"
      class="mt-7"
    />
  </section>
</template>
