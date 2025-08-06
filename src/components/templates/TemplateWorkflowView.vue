<template>
  <DataView
    :value="finalDisplayTemplates"
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

        <!-- Subcategory Navigation -->
        <div
          v-if="availableSubcategories.length > 0"
          class="mb-4 overflow-x-scroll flex max-w-[1000px]"
        >
          <div class="flex gap-2 pb-2">
            <Button
              :severity="selectedSubcategory === null ? 'primary' : 'secondary'"
              :outlined="selectedSubcategory !== null"
              size="small"
              class="rounded-2xl whitespace-nowrap"
              @click="$emit('update:selectedSubcategory', null)"
            >
              {{ $t('templateWorkflows.allSubcategories') }}
            </Button>
            <Button
              v-for="subcategory in availableSubcategories"
              :key="subcategory"
              :severity="
                selectedSubcategory === subcategory ? 'primary' : 'secondary'
              "
              :outlined="selectedSubcategory !== subcategory"
              size="small"
              class="rounded-2xl whitespace-nowrap"
              @click="$emit('update:selectedSubcategory', subcategory)"
            >
              {{ subcategory }}
            </Button>
          </div>
        </div>
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
import Button from 'primevue/button'
import DataView from 'primevue/dataview'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'
import TemplateWorkflowCardSkeleton from '@/components/templates/TemplateWorkflowCardSkeleton.vue'
import TemplateWorkflowList from '@/components/templates/TemplateWorkflowList.vue'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { useLazyPagination } from '@/composables/useLazyPagination'
import type { TemplateInfo } from '@/types/workflowTemplateTypes'

const { t } = useI18n()

const {
  title,
  sourceModule,
  categoryTitle,
  loading,
  templates,
  availableSubcategories,
  selectedSubcategory
} = defineProps<{
  title: string
  sourceModule: string
  categoryTitle: string
  loading: string | null
  templates: TemplateInfo[]
  availableSubcategories: string[]
  selectedSubcategory: string | null
}>()

const layout = useLocalStorage<'grid' | 'list'>(
  'Comfy.TemplateWorkflow.Layout',
  'grid'
)

const skeletonCount = 6
const loadTrigger = ref<HTMLElement | null>(null)

// Since filtering is now handled at parent level, we just use the templates directly
const displayTemplates = computed(() => templates || [])

// Simplified pagination - only show pagination when we have lots of templates
const shouldUsePagination = computed(() => templates.length > 12)

// Lazy pagination setup using templates directly
const {
  paginatedItems: paginatedTemplates,
  isLoading: isLoadingMore,
  hasMoreItems: hasMoreTemplates,
  loadNextPage,
  reset: resetPagination
} = useLazyPagination(displayTemplates, {
  itemsPerPage: 12
})

// Final templates to display with pagination
const finalDisplayTemplates = computed(() => {
  return shouldUsePagination.value
    ? paginatedTemplates.value
    : displayTemplates.value
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

watch([() => templates], () => {
  resetPagination()
})

const emit = defineEmits<{
  loadWorkflow: [name: string]
  'update:selectedSubcategory': [value: string | null]
}>()

const onLoadWorkflow = (name: string) => {
  emit('loadWorkflow', name)
}
</script>
