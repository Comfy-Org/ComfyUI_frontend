<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import CardWorkflow01 from '../../blocks/CardWorkflow01.vue'
import type { CardWorkflowItem } from '../../blocks/CardWorkflow01.vue'
import SearchField from '../../ui/search-field/SearchField.vue'
import HubFilterTabs from '../../ui/hub-filter-tabs/HubFilterTabs.vue'
import type { ModelCategory } from '../../../config/modelCategories'

import ModelCategoryFilter from './ModelCategoryFilter.vue'
import type {
  ModelCatalogFilterValue,
  ModelCategoryOption
} from './ModelCategoryFilter.vue'
import ModelMediaPlaceholder from './ModelMediaPlaceholder.vue'
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
  showCatalogByDefault = false
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

  return {
    id: model.slug,
    title: model.title,
    href: model.href,
    target: '_self',
    description:
      model.kind === 'release' && model.componentCount
        ? `${workflowDescription(model.workflowCount)} ${componentDescription(model.componentCount)}`
        : workflowDescription(model.workflowCount),
    tags:
      model.access === 'partner'
        ? [partnerLabel, ...categoryTags]
        : model.kind === 'release' && openLabel
          ? [openLabel, ...categoryTags]
          : categoryTags,
    media: model.thumbnailUrl
      ? { type: 'image', src: model.thumbnailUrl, alt: '' }
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
    v-if="isActive"
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
        v-for="model in filteredCatalog"
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
