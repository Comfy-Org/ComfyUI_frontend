<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import CardWorkflow01 from '../../blocks/CardWorkflow01.vue'
import type { CardWorkflowItem } from '../../blocks/CardWorkflow01.vue'
import BrandButton from '../../common/BrandButton.vue'
import SectionLabel from '../../common/SectionLabel.vue'
import SearchField from '../../ui/search-field/SearchField.vue'
import HubFilterTabs from '../../ui/hub-filter-tabs/HubFilterTabs.vue'
import type { ModelCategory } from '../../../config/modelCategories'

import ModelCategoryFilter from './ModelCategoryFilter.vue'
import type {
  ModelCatalogFilterValue,
  ModelCategoryOption
} from './ModelCategoryFilter.vue'
import ModelMediaPlaceholder from './ModelMediaPlaceholder.vue'
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
  releaseCatalog,
  categoryOptions,
  categoryLabel,
  searchLabel,
  searchPlaceholder,
  workflowCountOne,
  workflowCountMany,
  partnerLabel,
  openLabel,
  viewLabel,
  releasesLabel,
  componentsLabel,
  componentCountOne,
  componentCountMany,
  resultCountLabel,
  emptyLabel,
  showCatalogByDefault = false,
  resultLimit,
  defaultModels,
  collectionHeadingId,
  collectionLabel,
  collectionDescription,
  collectionActionLabel,
  collectionActionHref,
  openWeightsBadgeLabel
} = defineProps<{
  catalog: ModelExploreCatalogItem[]
  releaseCatalog?: ModelExploreCatalogItem[]
  categoryOptions: ModelCategoryOption[]
  categoryLabel: string
  searchLabel: string
  searchPlaceholder: string
  workflowCountOne: string
  workflowCountMany: string
  partnerLabel: string
  openLabel?: string
  viewLabel?: string
  releasesLabel?: string
  componentsLabel?: string
  componentCountOne?: string
  componentCountMany?: string
  resultCountLabel: string
  emptyLabel: string
  showCatalogByDefault?: boolean
  resultLimit?: number
  defaultModels?: ExploreModelCardFixture[]
  collectionHeadingId?: string
  collectionLabel?: string
  collectionDescription?: string
  collectionActionLabel?: string
  collectionActionHref?: string
  openWeightsBadgeLabel?: string
}>()

const query = ref('')
const catalogMode = ref<'releases' | 'components'>(
  releaseCatalog ? 'releases' : 'components'
)
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
const activeCatalog = computed(() =>
  catalogMode.value === 'releases' && releaseCatalog ? releaseCatalog : catalog
)
const filteredCatalog = computed(() =>
  filterModelExploreCatalog(
    activeCatalog.value,
    query.value,
    category.value,
    access.value
  )
)
const displayedCatalog = computed(() =>
  resultLimit === undefined
    ? filteredCatalog.value
    : filteredCatalog.value.slice(0, resultLimit)
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

onMounted(() => {
  const searchParams = new URLSearchParams(window.location.search)
  const accessParam = searchParams.get('access')

  access.value =
    accessParam === 'open' || accessParam === 'partner' ? accessParam : 'all'
  showAll.value = showCatalogByDefault || searchParams.get('catalog') === 'all'
  catalogMode.value =
    releaseCatalog && searchParams.get('view') !== 'components'
      ? 'releases'
      : 'components'
})

watch(catalogMode, (mode) => {
  if (!releaseCatalog) return
  const url = new URL(window.location.href)
  if (mode === 'components') url.searchParams.set('view', 'components')
  else url.searchParams.delete('view')
  window.history.replaceState({}, '', url)
})

function workflowDescription(workflowCount: number): string {
  return (workflowCount === 1 ? workflowCountOne : workflowCountMany).replace(
    '{count}',
    String(workflowCount)
  )
}

function componentDescription(componentCount: number): string {
  const label = componentCount === 1 ? componentCountOne : componentCountMany
  return label?.replace('{count}', String(componentCount)) ?? ''
}

function toWorkflowItem(model: ModelExploreCatalogItem): CardWorkflowItem {
  const categoryTags = model.categories
    .slice(0, 2)
    .map((modelCategory) => categoryLabels.value.get(modelCategory))
    .filter((label): label is string => label !== undefined)
  const publisherTags =
    model.kind === 'release' && model.publisher ? [model.publisher] : []

  return {
    id: model.slug,
    title: model.title,
    href: model.href,
    target: '_self',
    description:
      model.kind === 'release' && model.componentCount
        ? `${workflowDescription(model.workflowCount)} ${componentDescription(model.componentCount)}`
        : workflowDescription(model.workflowCount),
    ...(model.kind === 'release' && model.publisher
      ? { sourceLabel: model.publisher }
      : {}),
    tags:
      model.access === 'partner'
        ? [partnerLabel, ...publisherTags, ...categoryTags]
        : model.kind === 'release' && openLabel
          ? [openLabel, ...publisherTags, ...categoryTags]
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
</script>

<template>
  <section
    v-if="releaseCatalog"
    class="max-w-10xl mx-auto px-6 pt-8 md:px-10 xl:px-30"
  >
    <HubFilterTabs
      v-model="catalogMode"
      :label="viewLabel ?? ''"
      :items="[
        { value: 'releases', label: releasesLabel ?? '' },
        { value: 'components', label: componentsLabel ?? '' }
      ]"
    />
  </section>
  <section class="max-w-10xl mx-auto px-6 py-8 md:px-10 xl:px-30">
    <SearchField
      v-model="query"
      :label="searchLabel"
      :placeholder="searchPlaceholder"
      :status="resultStatus"
    />
  </section>
  <div class="max-w-10xl mx-auto overflow-x-auto px-6 py-3 md:px-10 xl:px-30">
    <ModelCategoryFilter
      v-model="filterSelection"
      :label="categoryLabel"
      :categories="categoryOptions"
    />
  </div>
  <section
    v-if="defaultModels"
    id="model-catalog-results"
    :aria-labelledby="collectionHeadingId"
    class="max-w-10xl mx-auto px-6 pt-14 pb-8 md:px-10 xl:px-30"
  >
    <div
      class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="flex flex-col gap-2">
        <h2 :id="collectionHeadingId">
          <SectionLabel>{{ collectionLabel }}</SectionLabel>
        </h2>
        <p class="text-base font-light text-primary-warm-gray">
          {{ collectionDescription }}
        </p>
      </div>
      <div
        v-if="collectionActionHref && collectionActionLabel"
        class="shrink-0"
      >
        <BrandButton :href="collectionActionHref" variant="outline" size="xs">
          {{ collectionActionLabel }}
        </BrandButton>
      </div>
    </div>
    <p
      v-if="isActive && filteredCatalog.length === 0"
      class="text-content-secondary py-10 text-center text-base font-light"
    >
      {{ emptyLabel }}
    </p>
    <div v-else class="mt-7 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <template v-if="isActive">
        <CardWorkflow01
          v-for="model in displayedCatalog"
          :key="model.slug"
          :item="toWorkflowItem(model)"
          variant="compact"
        >
          <template v-if="!model.thumbnailUrl" #media>
            <ModelMediaPlaceholder :tone="model.mediaTone" />
          </template>
        </CardWorkflow01>
      </template>
      <template v-else>
        <CardWorkflow01
          v-for="model in defaultModels"
          :key="model.name"
          :item="toDefaultWorkflowItem(model)"
          variant="compact"
        >
          <template v-if="model.media.type === 'placeholder'" #media>
            <ModelMediaPlaceholder :tone="model.media.tone" />
          </template>
        </CardWorkflow01>
      </template>
    </div>
  </section>
  <section
    v-else-if="isActive"
    id="model-catalog-results"
    class="max-w-10xl mx-auto px-6 pt-8 pb-4 md:px-10 xl:px-30"
  >
    <p
      v-if="filteredCatalog.length === 0"
      class="text-content-secondary py-10 text-center text-base font-light"
    >
      {{ emptyLabel }}
    </p>
    <div v-else class="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <CardWorkflow01
        v-for="model in displayedCatalog"
        :key="model.slug"
        :item="toWorkflowItem(model)"
        variant="compact"
      >
        <template v-if="!model.thumbnailUrl" #media>
          <ModelMediaPlaceholder :tone="model.mediaTone" />
        </template>
      </CardWorkflow01>
    </div>
  </section>
</template>
