<template>
  <DataView
    :value="displayTemplates"
    :layout="layout"
    data-key="name"
    :lazy="true"
    pt:root="h-full grid grid-rows-[auto_1fr_auto]"
    pt:content="p-2 overflow-auto"
  >
    <template #header>
      <div class="flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg">{{ title }}</h2>
          <SelectButton
            v-model="layout"
            :options="['grid', 'list']"
            :allow-empty="false"
          >
            <template #option="{ option }">
              <i :class="[option === 'list' ? 'pi pi-bars' : 'pi pi-table']" />
            </template>
          </SelectButton>
        </div>
        <TemplateSearchBar
          v-model:search-query="searchQuery"
          :filtered-count="filteredCount"
          @clear-filters="() => reset()"
        />
      </div>
    </template>

    <template #list="{ items }">
      <TemplateWorkflowList
        :source-module="sourceModule"
        :templates="items"
        :loading="loading"
        :category-title="categoryTitle"
        @load-workflow="onLoadWorkflow"
      />
    </template>

    <template #grid="{ items }">
      <div>
        <div
          class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-x-4 gap-y-8 px-4 justify-items-center"
        >
          <TemplateWorkflowCard
            v-for="template in items"
            :key="template.name"
            :source-module="sourceModule"
            :template="template"
            :loading="loading === template.name"
            :category-title="categoryTitle"
            @load-workflow="onLoadWorkflow"
          />
          <TemplateWorkflowCardSkeleton
            v-for="n in shouldUsePagination && isLoadingMore
              ? skeletonCount
              : 0"
            :key="`skeleton-${n}`"
          />
        </div>
        <div
          v-if="shouldUsePagination && hasMoreTemplates"
          ref="loadTrigger"
          class="w-full h-4 flex justify-center items-center"
        >
          <div v-if="isLoadingMore" class="text-sm text-muted">
            {{ t('templateWorkflows.loadingMore') }}
          </div>
        </div>
      </div>
    </template>
  </DataView>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import DataView from 'primevue/dataview'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import TemplateSearchBar from '@/components/templates/TemplateSearchBar.vue'
import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'
import TemplateWorkflowCardSkeleton from '@/components/templates/TemplateWorkflowCardSkeleton.vue'
import TemplateWorkflowList from '@/components/templates/TemplateWorkflowList.vue'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { useLazyPagination } from '@/composables/useLazyPagination'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import type { TemplateInfo } from '@/types/workflowTemplateTypes'

const { t } = useI18n()

const { title, sourceModule, categoryTitle, loading, templates } = defineProps<{
  title: string
  sourceModule: string
  categoryTitle: string
  loading: string | null
  templates: TemplateInfo[]
}>()

const layout = useLocalStorage<'grid' | 'list'>(
  'Comfy.TemplateWorkflow.Layout',
  'grid'
)

const skeletonCount = 6
const loadTrigger = ref<HTMLElement | null>(null)

const templatesRef = computed(() => templates || [])

const { searchQuery, filteredTemplates, filteredCount } =
  useTemplateFiltering(templatesRef)

// When searching, show all results immediately without pagination
// When not searching, use lazy pagination
const shouldUsePagination = computed(() => !searchQuery.value.trim())

// Lazy pagination setup using filtered templates
const {
  paginatedItems: paginatedTemplates,
  isLoading: isLoadingMore,
  hasMoreItems: hasMoreTemplates,
  loadNextPage,
  reset
} = useLazyPagination(filteredTemplates, {
  itemsPerPage: 12
})

// Final templates to display
const displayTemplates = computed(() => {
  return shouldUsePagination.value
    ? paginatedTemplates.value
    : filteredTemplates.value
})
// Intersection observer for auto-loading (only when not searching)
useIntersectionObserver(
  loadTrigger,
  (entries) => {
    const entry = entries[0]
    if (
      entry?.isIntersecting &&
      shouldUsePagination.value &&
      hasMoreTemplates.value &&
      !isLoadingMore.value
    ) {
      void loadNextPage()
    }
  },
  {
    rootMargin: '200px',
    threshold: 0.1
  }
)

watch([() => templates, searchQuery], () => {
  reset()
})

const emit = defineEmits<{
  loadWorkflow: [name: string]
}>()

const onLoadWorkflow = (name: string) => {
  emit('loadWorkflow', name)
}
</script>
