<template>
  <WorkflowDetailView
    v-if="selectedWorkflow"
    :workflow="selectedWorkflow"
    @back="selectedWorkflow = null"
    @run-workflow="handleRunWorkflow"
    @make-copy="handleMakeCopy"
  />
  <div v-else class="flex size-full flex-col">
    <!-- Header with search -->
    <div
      class="flex shrink-0 items-center gap-4 border-b border-interface-stroke px-6 py-4"
    >
      <h1 class="text-xl font-semibold text-base-foreground">
        {{ $t('sideToolbar.discover') }}
      </h1>
      <SearchBox
        v-model="searchQuery"
        :placeholder="$t('discover.searchPlaceholder')"
        size="lg"
        class="max-w-md flex-1"
        show-border
        @search="handleSearch"
      />
    </div>

    <!-- Filters -->
    <div class="flex shrink-0 flex-wrap items-center gap-3 px-6 py-3">
      <!-- Tags filter -->
      <MultiSelect
        v-model="selectedTags"
        :label="$t('discover.filters.tags')"
        :options="tagOptions"
        :show-search-box="true"
        :show-selected-count="true"
        :show-clear-button="true"
        class="w-48"
      >
        <template #icon>
          <i class="icon-[lucide--tag]" />
        </template>
      </MultiSelect>

      <!-- Models filter -->
      <MultiSelect
        v-model="selectedModels"
        :label="$t('discover.filters.models')"
        :options="modelOptions"
        :show-search-box="true"
        :show-selected-count="true"
        :show-clear-button="true"
        class="w-48"
      >
        <template #icon>
          <i class="icon-[lucide--cpu]" />
        </template>
      </MultiSelect>

      <!-- Open source toggle -->
      <Button
        :variant="openSourceOnly ? 'primary' : 'secondary'"
        size="md"
        @click="openSourceOnly = !openSourceOnly"
      >
        <i class="icon-[lucide--unlock]" />
        {{ $t('discover.filters.openSource') }}
      </Button>

      <!-- Cloud only toggle -->
      <Button
        :variant="cloudOnly ? 'primary' : 'secondary'"
        size="md"
        @click="cloudOnly = !cloudOnly"
      >
        <i class="icon-[lucide--cloud]" />
        {{ $t('discover.filters.cloudOnly') }}
      </Button>

      <div class="flex-1" />

      <!-- Results count -->
      <span v-if="!isLoading && results" class="text-sm text-muted-foreground">
        {{
          $t(
            'discover.resultsCount',
            { count: results.totalHits },
            results.totalHits
          )
        }}
      </span>
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-y-auto px-6 py-4">
      <!-- Loading state -->
      <div
        v-if="isLoading"
        class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
      >
        <CardContainer
          v-for="n in 12"
          :key="`skeleton-${n}`"
          size="compact"
          variant="ghost"
          class="hover:bg-base-background"
        >
          <template #top>
            <CardTop ratio="landscape">
              <div class="size-full animate-pulse bg-dialog-surface" />
            </CardTop>
          </template>
          <template #bottom>
            <div class="p-3">
              <div
                class="mb-2 h-5 w-3/4 animate-pulse rounded bg-dialog-surface"
              />
              <div class="h-4 w-full animate-pulse rounded bg-dialog-surface" />
            </div>
          </template>
        </CardContainer>
      </div>

      <!-- No results state -->
      <div
        v-else-if="!cloudOnly || (results && results.templates.length === 0)"
        class="flex h-64 flex-col items-center justify-center text-muted-foreground"
      >
        <i class="icon-[lucide--search] mb-4 size-12 opacity-50" />
        <p class="mb-2 text-lg">{{ $t('discover.noResults') }}</p>
        <p class="text-sm">{{ $t('discover.noResultsHint') }}</p>
      </div>

      <!-- Results grid -->
      <div
        v-else-if="results"
        class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
      >
        <CardContainer
          v-for="template in results.templates"
          :key="template.objectID"
          size="compact"
          variant="ghost"
          class="hover:bg-base-background"
          @mouseenter="hoveredTemplate = template.objectID"
          @mouseleave="hoveredTemplate = null"
          @click="handleTemplateClick(template)"
        >
          <template #top>
            <CardTop ratio="landscape">
              <LazyImage
                :src="template.thumbnail_url"
                :alt="template.title"
                class="size-full object-cover transition-transform duration-300"
                :class="hoveredTemplate === template.objectID && 'scale-105'"
              />
              <template #bottom-right>
                <SquareChip
                  v-for="tag in template.tags.slice(0, 2)"
                  :key="tag"
                  :label="tag"
                />
              </template>
            </CardTop>
          </template>
          <template #bottom>
            <div class="flex flex-col gap-1.5 p-3">
              <h3
                class="line-clamp-1 text-sm font-medium"
                :title="template.title"
              >
                {{ template.title }}
              </h3>
              <p
                class="line-clamp-2 text-xs text-muted-foreground"
                :title="template.description"
              >
                {{ template.description }}
              </p>
              <div class="mt-1 flex flex-wrap gap-1">
                <span
                  v-for="model in template.models.slice(0, 2)"
                  :key="model"
                  class="rounded bg-secondary-background px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {{ model }}
                </span>
                <span
                  v-if="template.models.length > 2"
                  class="text-xs text-muted-foreground"
                >
                  +{{ template.models.length - 2 }}
                </span>
              </div>
            </div>
          </template>
        </CardContainer>
      </div>

      <!-- Initial state -->
      <div
        v-else
        class="flex h-64 flex-col items-center justify-center text-muted-foreground"
      >
        <i class="icon-[lucide--compass] mb-4 size-16 opacity-50" />
        <p class="text-lg">{{ $t('sideToolbar.discoverPlaceholder') }}</p>
      </div>
    </div>

    <!-- Pagination (inside v-else block) -->
    <div
      v-if="results && results.totalPages > 1"
      class="flex shrink-0 items-center justify-center gap-2 border-t border-interface-stroke px-6 py-3"
    >
      <Button
        variant="secondary"
        size="md"
        :disabled="currentPage === 0"
        @click="goToPage(currentPage - 1)"
      >
        <i class="icon-[lucide--chevron-left]" />
      </Button>
      <span class="px-4 text-sm text-muted-foreground">
        {{ currentPage + 1 }} / {{ results.totalPages }}
      </span>
      <Button
        variant="secondary"
        size="md"
        :disabled="currentPage >= results.totalPages - 1"
        @click="goToPage(currentPage + 1)"
      >
        <i class="icon-[lucide--chevron-right]" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import LazyImage from '@/components/common/LazyImage.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import WorkflowDetailView from '@/components/discover/WorkflowDetailView.vue'
import MultiSelect from '@/components/input/MultiSelect.vue'
import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSearch } from '@/composables/discover/useWorkflowTemplateSearch'
import type { AlgoliaWorkflowTemplate } from '@/types/discoverTypes'

const { search, isLoading, results } = useWorkflowTemplateSearch()

const searchQuery = ref('')
const currentPage = ref(0)
const hoveredTemplate = ref<string | null>(null)
const selectedWorkflow = ref<AlgoliaWorkflowTemplate | null>(null)

const selectedTags = ref<Array<{ name: string; value: string }>>([])
const selectedModels = ref<Array<{ name: string; value: string }>>([])
const openSourceOnly = ref(false)
const cloudOnly = ref(true)

// Store initial facet values to preserve filter options
const initialFacets = ref<Record<string, Record<string, number>> | null>(null)

const tagOptions = computed(() => {
  const facets = initialFacets.value?.tags ?? results.value?.facets?.tags
  if (!facets) return []
  return Object.entries(facets).map(([tag, count]) => ({
    name: `${tag} (${count})`,
    value: tag
  }))
})

const modelOptions = computed(() => {
  const facets = initialFacets.value?.models ?? results.value?.facets?.models
  if (!facets) return []
  return Object.entries(facets).map(([model, count]) => ({
    name: `${model} (${count})`,
    value: model
  }))
})

function buildFacetFilters(): string[][] {
  const filters: string[][] = []

  if (selectedTags.value.length > 0) {
    filters.push(selectedTags.value.map((t) => `tags:${t.value}`))
  }
  if (selectedModels.value.length > 0) {
    filters.push(selectedModels.value.map((m) => `models:${m.value}`))
  }
  if (openSourceOnly.value) {
    filters.push(['open_source:true'])
  }

  return filters
}

async function performSearch() {
  const result = await search({
    query: searchQuery.value,
    pageSize: 24,
    pageNumber: currentPage.value,
    facetFilters: buildFacetFilters()
  })

  // Store initial facets on first search (no filters applied)
  if (!initialFacets.value && result.facets) {
    initialFacets.value = result.facets
  }
}

function handleSearch() {
  currentPage.value = 0
  performSearch()
}

function goToPage(page: number) {
  currentPage.value = page
  performSearch()
}

function handleTemplateClick(template: AlgoliaWorkflowTemplate) {
  selectedWorkflow.value = template
}

function handleRunWorkflow(_workflow: AlgoliaWorkflowTemplate) {
  // TODO: Implement workflow run
}

function handleMakeCopy(_workflow: AlgoliaWorkflowTemplate) {
  // TODO: Implement make a copy
}

watch(
  [selectedTags, selectedModels, openSourceOnly, cloudOnly],
  () => {
    currentPage.value = 0
    performSearch()
  },
  { deep: true }
)

onMounted(() => {
  performSearch()
})
</script>
