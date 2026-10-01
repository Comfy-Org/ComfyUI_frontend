<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import ModelExploreGrid from './ModelExploreGrid.vue'
import type { CardWorkflowItem } from './ModelExploreCard.vue'
import ModelCollectionHeader from './ModelCollectionHeader.vue'
import SearchField from './ModelSearchField.vue'
import type { ModelCategory } from '../../../config/modelCategories'

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
  categoryOptions,
  categoryLabel,
  searchLabel,
  searchPlaceholder,
  workflowCountOne,
  workflowCountMany,
  partnerLabel,
  resultCountLabel,
  emptyLabel,
  showCatalogByDefault = false,
  catalogLabel,
  defaultModels,
  collectionHeadingId,
  collectionLabel,
  collectionDescription,
  collectionActionLabel,
  collectionActionHref,
  openWeightsBadgeLabel
} = defineProps<{
  catalog: ModelExploreCatalogItem[]
  categoryOptions: ModelCategoryOption[]
  categoryLabel: string
  searchLabel: string
  searchPlaceholder: string
  workflowCountOne: string
  workflowCountMany: string
  partnerLabel: string
  resultCountLabel: string
  emptyLabel: string
  showCatalogByDefault?: boolean
  catalogLabel?: string
  defaultModels?: ExploreModelCardFixture[]
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

const query = ref('')
const category = ref<'all' | ModelCategory>('all')
const access = ref<ModelAccessFilter>('all')
const filterSelection = computed<ModelCatalogFilterValue>({
  get: () => (access.value === 'all' ? category.value : access.value),
  set: (selection) => {
    if (selection === 'open' || selection === 'partner') {
      access.value = selection
      category.value = 'all'
      return
    }

    category.value = selection
    access.value = 'all'
  }
})
const showAll = ref(showCatalogByDefault)
const isActive = computed(
  () =>
    showAll.value ||
    query.value.trim().length > 0 ||
    category.value !== 'all' ||
    access.value !== 'all'
)
const filteredCatalog = computed(() =>
  filterModelExploreCatalog(catalog, query.value, category.value, access.value)
)
const isEmpty = computed(
  () => isActive.value && filteredCatalog.value.length === 0
)
const displayedCatalog = filteredCatalog
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

onMounted(async () => {
  const searchParams = new URLSearchParams(window.location.search)
  const accessParam = searchParams.get('access')

  access.value =
    accessParam === 'open' || accessParam === 'partner' ? accessParam : 'all'
  showAll.value = showCatalogByDefault || searchParams.get('catalog') === 'all'
  if (window.location.hash === '#model-catalog-results' && isActive.value) {
    await nextTick()
    document.getElementById('model-catalog-results')?.scrollIntoView()
  }
})

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
const defaultEntries = computed(() =>
  (defaultModels ?? []).map((model) => ({
    item: toDefaultWorkflowItem(model),
    tone:
      model.media.type === 'placeholder' ? model.media.tone : ('plum' as const)
  }))
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
    v-if="defaultModels"
    id="trending-models"
    :aria-labelledby="collectionHeadingId"
    :class="resultsClass"
  >
    <ModelCollectionHeader
      :heading-id="collectionHeadingId"
      :label="collectionLabel"
      :description="collectionDescription"
      :action-label="collectionActionLabel"
      :action-href="collectionActionHref"
    />
    <ModelExploreGrid :entries="defaultEntries" class="mt-7" />
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
      class="py-10 text-center text-base font-light text-content-secondary"
    >
      {{ emptyLabel }}
    </p>
    <ModelExploreGrid
      v-else
      :entries="displayEntries"
      :class="cn(catalogLabel && 'mt-7')"
    />
  </section>
</template>
