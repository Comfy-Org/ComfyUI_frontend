<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import CardWorkflow01 from '../../blocks/CardWorkflow01.vue'
import type { CardWorkflowItem } from '../../blocks/CardWorkflow01.vue'
import SearchField from '../../ui/search-field/SearchField.vue'
import type { ModelCategory } from '../../../config/modelCategories'

import ModelCategoryFilter from './ModelCategoryFilter.vue'
import type { ModelCategoryOption } from './ModelCategoryFilter.vue'
import ModelMediaPlaceholder from './ModelMediaPlaceholder.vue'
import { filterModelExploreCatalog } from './modelExploreCatalog';
import type { ModelExploreCatalogItem } from './modelExploreCatalog';

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
  showCatalogByDefault = false
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
}>()

const query = ref('')
const category = ref<'all' | ModelCategory>('all')
const showAll = ref(showCatalogByDefault)
const isActive = computed(
  () =>
    showAll.value || query.value.trim().length > 0 || category.value !== 'all'
)
const filteredCatalog = computed(() =>
  filterModelExploreCatalog(catalog, query.value, category.value)
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
  showAll.value =
    showCatalogByDefault ||
    new URLSearchParams(window.location.search).get('catalog') === 'all'
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
</script>

<template>
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
      v-model="category"
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
