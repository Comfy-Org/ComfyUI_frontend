<template>
  <BaseModalLayout
    :content-title="$t('templateWorkflows.title', 'Workflow Templates')"
    size="md"
  >
    <template #leftPanelHeaderTitle>
      <i class="icon-[comfy--template]" />
      <h2 class="text-neutral text-base">
        {{ $t('sideToolbar.templates', 'Templates') }}
      </h2>
    </template>
    <template #leftPanel>
      <LeftSidePanel v-model="selectedNavItem" :nav-items="navItems" />
    </template>

    <template #header>
      <SearchInput
        v-model="searchQuery"
        size="lg"
        class="max-w-96 flex-1"
        autofocus
      />
    </template>

    <template #header-right-area>
      <div class="flex gap-2">
        <Button
          v-if="filteredCount !== totalCount"
          variant="secondary"
          size="lg"
          @click="resetFilters"
        >
          <i class="icon-[lucide--filter-x]" />
          <span>{{
            $t('templateWorkflows.resetFilters', 'Clear Filters')
          }}</span>
        </Button>
      </div>
    </template>

    <template #contentFilter>
      <div class="relative flex flex-wrap justify-between gap-2 px-6 pb-4">
        <div class="flex flex-wrap gap-2">
          <!-- Model Filter -->
          <MultiSelect
            v-model="selectedModelObjects"
            v-model:search-query="modelSearchText"
            class="w-[250px]"
            :label="modelFilterLabel"
            :options="modelOptions"
            :show-search-box="true"
            :show-selected-count="true"
            :show-clear-button="true"
          >
            <template #icon>
              <i class="icon-[lucide--cpu]" />
            </template>
          </MultiSelect>

          <!-- Use Case Filter -->
          <MultiSelect
            v-model="selectedUseCaseObjects"
            :label="useCaseFilterLabel"
            :options="useCaseOptions"
            :show-search-box="true"
            :show-selected-count="true"
            :show-clear-button="true"
          >
            <template #icon>
              <i class="icon-[lucide--target]" />
            </template>
          </MultiSelect>

          <!-- Runs On Filter -->
          <MultiSelect
            v-model="selectedRunsOnObjects"
            :label="runsOnFilterLabel"
            :options="runsOnOptions"
            :show-search-box="true"
            :show-selected-count="true"
            :show-clear-button="true"
          >
            <template #icon>
              <i class="icon-[lucide--server]" />
            </template>
          </MultiSelect>
        </div>

        <!-- Sort Options -->
        <div>
          <SingleSelect
            v-model="sortBy"
            :label="$t('templateWorkflows.sorting', 'Sort by')"
            :options="sortOptions"
            class="w-62.5"
          >
            <template #icon>
              <i class="icon-[lucide--arrow-up-down] text-muted-foreground" />
            </template>
          </SingleSelect>
        </div>
      </div>
      <div
        v-if="!isLoading"
        class="text-neutral px-6 pt-4 pb-2 text-2xl font-semibold"
      >
        <span>
          {{ pageTitle }}
        </span>
      </div>
    </template>

    <template #content>
      <!-- No Results State (only show when loaded and no results) -->
      <div
        v-if="!isLoading && filteredTemplates.length === 0"
        class="flex h-64 flex-col items-center justify-center text-neutral-500"
      >
        <i class="mb-4 icon-[lucide--search] size-12 opacity-50" />
        <p class="mb-2 text-lg">
          {{ $t('templateWorkflows.noResults', 'No templates found') }}
        </p>
        <p class="text-sm">
          {{
            $t(
              'templateWorkflows.noResultsHint',
              'Try adjusting your search or filters'
            )
          }}
        </p>
      </div>
      <div v-else>
        <!-- Title -->
        <span
          v-if="isLoading"
          class="inline-block h-8 w-48 animate-pulse rounded-sm bg-dialog-surface"
        ></span>

        <TemplateCardGrid
          :templates="displayTemplates"
          :is-loading="isLoading"
          :is-loading-more="isLoadingMore"
          :loading-template-name="loadingTemplate"
          :hovered-template-name="hoveredTemplate"
          :list-key="templateListKey"
          :distributions="distributions"
          @select="onLoadWorkflow"
          @mouseenter="(t) => (hoveredTemplate = t.name)"
          @mouseleave="hoveredTemplate = null"
        />
      </div>

      <!-- Load More Trigger -->
      <div
        v-if="!isLoading && hasMoreTemplates"
        ref="loadTrigger"
        class="mt-4 flex h-4 w-full items-center justify-center"
      >
        <div v-if="isLoadingMore" class="text-sm text-muted">
          {{ $t('templateWorkflows.loadingMore', 'Loading more...') }}
        </div>
      </div>

      <!-- Results Summary -->
      <div v-if="!isLoading" class="mt-6 px-6 text-sm text-muted">
        {{
          $t('templateWorkflows.resultsCount', {
            count: filteredCount,
            total: totalCount
          })
        }}
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import TemplateCardGrid from '@/platform/workflow/templates/components/TemplateCardGrid.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import MultiSelect from '@/components/input/MultiSelect.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import Button from '@/components/ui/button/Button.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { useLazyPagination } from '@/composables/useLazyPagination'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { TemplateIncludeOnDistributionEnum } from '@/platform/workflow/templates/types/template'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'

const { t } = useI18n()

const { onClose: originalOnClose, initialCategory = 'all' } = defineProps<{
  onClose: () => void
  initialCategory?: string
}>()

// Track session time for telemetry
const sessionStartTime = ref<number>(0)
const templateWasSelected = ref(false)

onMounted(() => {
  sessionStartTime.value = Date.now()
})

const systemStatsStore = useSystemStatsStore()

const distributions = computed(() => {
  switch (__DISTRIBUTION__) {
    case 'cloud':
      return [TemplateIncludeOnDistributionEnum.Cloud]
    case 'localhost':
      return [TemplateIncludeOnDistributionEnum.Local]
    case 'desktop':
    default:
      if (systemStatsStore.systemStats?.system.os === 'darwin') {
        return [
          TemplateIncludeOnDistributionEnum.Desktop,
          TemplateIncludeOnDistributionEnum.Mac
        ]
      }
      return [
        TemplateIncludeOnDistributionEnum.Desktop,
        TemplateIncludeOnDistributionEnum.Windows
      ]
  }
})

// Wrap onClose to track session end
const onClose = () => {
  if (isCloud) {
    const timeSpentSeconds = Math.floor(
      (Date.now() - sessionStartTime.value) / 1000
    )

    useTelemetry()?.trackTemplateLibraryClosed({
      template_selected: templateWasSelected.value,
      time_spent_seconds: timeSpentSeconds
    })
  }

  originalOnClose()
}

provide(OnCloseKey, onClose)

// Workflow templates store and composable
const workflowTemplatesStore = useWorkflowTemplatesStore()
const { loadTemplates, loadWorkflowTemplate } = useTemplateWorkflows()

function getEffectiveSourceModule(template: TemplateInfo) {
  return template.sourceModule || 'default'
}

// Get navigation items from the store, with skeleton items while loading
const navItems = computed<(NavItemData | NavGroupData)[]>(() => {
  // Show skeleton navigation items while loading
  if (isLoading.value) {
    return [
      {
        id: 'skeleton-all',
        label: 'All Templates',
        icon: 'icon-[lucide--layout-grid]'
      },
      {
        id: 'skeleton-basics',
        label: 'Basics',
        icon: 'icon-[lucide--graduation-cap]'
      },
      {
        title: 'Generation Type',
        items: [
          { id: 'skeleton-1', label: '...', icon: 'icon-[lucide--loader-2]' },
          { id: 'skeleton-2', label: '...', icon: 'icon-[lucide--loader-2]' }
        ]
      },
      {
        title: 'Closed Source Models',
        items: [
          { id: 'skeleton-3', label: '...', icon: 'icon-[lucide--loader-2]' }
        ]
      }
    ]
  }
  return workflowTemplatesStore.navGroupedTemplates
})

// Get enhanced templates for better filtering
const allTemplates = computed(() => {
  return workflowTemplatesStore.enhancedTemplates
})

// Navigation
const selectedNavItem = ref<string | null>(initialCategory)

// Filter templates based on selected navigation item
const navigationFilteredTemplates = computed(() => {
  if (!selectedNavItem.value) {
    return allTemplates.value
  }

  return workflowTemplatesStore.filterTemplatesByCategory(selectedNavItem.value)
})

// Template filtering with scope awareness
const {
  searchQuery,
  selectedModels,
  selectedUseCases,
  selectedRunsOn,
  sortBy,
  activeModels,
  activeUseCases,
  filteredTemplates,
  availableModels,
  availableUseCases,
  availableRunsOn,
  filteredCount,
  totalCount,
  resetFilters,
  loadFuseOptions
} = useTemplateFiltering(navigationFilteredTemplates, selectedNavItem)

/**
 * Coordinates state between the selected navigation item and the sort order to
 * create deterministic, predictable behavior.
 * @param source The origin of the change ('nav' or 'sort').
 */
const coordinateNavAndSort = (source: 'nav' | 'sort') => {
  const isPopularNav = selectedNavItem.value === 'popular'
  const isPopularSort = sortBy.value === 'popular'

  if (source === 'nav') {
    if (isPopularNav && !isPopularSort) {
      // When navigating to 'Popular' category, automatically set sort to 'Popular'.
      sortBy.value = 'popular'
    } else if (!isPopularNav && isPopularSort) {
      // When navigating away from 'Popular' category while sort is 'Popular', reset sort to default.
      sortBy.value = 'default'
    }
  } else if (source === 'sort') {
    // When sort is changed away from 'Popular' while in the 'Popular' category,
    // reset the category to 'All Templates' to avoid a confusing state.
    if (isPopularNav && !isPopularSort) {
      selectedNavItem.value = 'all'
    }
  }
}

// Watch for changes from the two sources ('nav' and 'sort') and trigger the coordinator.
watch(selectedNavItem, () => coordinateNavAndSort('nav'))
watch(sortBy, () => coordinateNavAndSort('sort'))

// Convert between string array and object array for MultiSelect component
// Only show selected items that exist in the current scope
const selectedModelObjects = computed({
  get() {
    // Only include selected models that exist in availableModels
    return activeModels.value.map((model) => ({ name: model, value: model }))
  },
  set(value: { name: string; value: string }[]) {
    selectedModels.value = value.map((item) => item.value)
  }
})

const selectedUseCaseObjects = computed({
  get() {
    return activeUseCases.value.map((useCase) => ({
      name: useCase,
      value: useCase
    }))
  },
  set(value: { name: string; value: string }[]) {
    selectedUseCases.value = value.map((item) => item.value)
  }
})

const selectedRunsOnObjects = computed({
  get() {
    return selectedRunsOn.value.map((runsOn) => ({
      name: runsOn,
      value: runsOn
    }))
  },
  set(value: { name: string; value: string }[]) {
    selectedRunsOn.value = value.map((item) => item.value)
  }
})

// Loading states
const loadingTemplate = ref<string | null>(null)
const hoveredTemplate = ref<string | null>(null)

// Force re-render key for templates when sorting changes
const templateListKey = ref(0)

// Search text for model filter
const modelSearchText = ref<string>('')

// Filter options
const modelOptions = computed(() =>
  availableModels.value.map((model) => ({
    name: model,
    value: model
  }))
)

const useCaseOptions = computed(() =>
  availableUseCases.value.map((useCase) => ({
    name: useCase,
    value: useCase
  }))
)

const runsOnOptions = computed(() =>
  availableRunsOn.value.map((runsOn) => ({
    name: runsOn,
    value: runsOn
  }))
)

// Filter labels
const modelFilterLabel = computed(() => {
  if (selectedModelObjects.value.length === 0) {
    return t('templateWorkflows.modelFilter', 'Model Filter')
  } else if (selectedModelObjects.value.length === 1) {
    return selectedModelObjects.value[0].name
  } else {
    return t('templateWorkflows.modelsSelected', {
      count: selectedModelObjects.value.length
    })
  }
})

const useCaseFilterLabel = computed(() => {
  if (selectedUseCaseObjects.value.length === 0) {
    return t('templateWorkflows.useCaseFilter', 'Use Case')
  } else if (selectedUseCaseObjects.value.length === 1) {
    return selectedUseCaseObjects.value[0].name
  } else {
    return t('templateWorkflows.useCasesSelected', {
      count: selectedUseCaseObjects.value.length
    })
  }
})

const runsOnFilterLabel = computed(() => {
  if (selectedRunsOnObjects.value.length === 0) {
    return t('templateWorkflows.runsOnFilter', 'Runs On')
  } else if (selectedRunsOnObjects.value.length === 1) {
    return selectedRunsOnObjects.value[0].name
  } else {
    return t('templateWorkflows.runsOnSelected', {
      count: selectedRunsOnObjects.value.length
    })
  }
})

// Sort options
const sortOptions = computed(() => [
  {
    name: t('templateWorkflows.sort.default', 'Default'),
    value: 'default'
  },
  {
    name: t('templateWorkflows.sort.recommended', 'Recommended'),
    value: 'recommended'
  },
  {
    name: t('templateWorkflows.sort.popular', 'Popular'),
    value: 'popular'
  },
  { name: t('templateWorkflows.sort.newest', 'Newest'), value: 'newest' },
  {
    name: t('templateWorkflows.sort.vramLowToHigh', 'VRAM Usage (Low to High)'),
    value: 'vram-low-to-high'
  },
  {
    name: t(
      'templateWorkflows.sort.modelSizeLowToHigh',
      'Model Size (Low to High)'
    ),
    value: 'model-size-low-to-high'
  },
  {
    name: t('templateWorkflows.sort.alphabetical', 'Alphabetical (A-Z)'),
    value: 'alphabetical'
  }
])

// Lazy pagination setup
const loadTrigger = ref<HTMLElement | null>(null)
const shouldUsePagination = computed(() => !searchQuery.value.trim())

const {
  paginatedItems: paginatedTemplates,
  isLoading: isLoadingMore,
  hasMoreItems: hasMoreTemplates,
  loadNextPage,
  reset: resetPagination
} = useLazyPagination(filteredTemplates, { itemsPerPage: 24 }) // Load 24 items per page

// Display templates (all when searching, paginated when not)
const displayTemplates = computed(() => {
  return shouldUsePagination.value
    ? paginatedTemplates.value
    : filteredTemplates.value
})

// Set up intersection observer for lazy loading
useIntersectionObserver(loadTrigger, () => {
  if (
    shouldUsePagination.value &&
    hasMoreTemplates.value &&
    !isLoadingMore.value
  ) {
    void loadNextPage()
  }
})

// Reset pagination when filters change
watch(
  [
    filteredTemplates,
    selectedNavItem,
    sortBy,
    selectedModels,
    selectedUseCases,
    selectedRunsOn
  ],
  () => {
    resetPagination()
    // Clear loading state and force re-render of template list
    loadingTemplate.value = null
    templateListKey.value++
  }
)

// Methods
const onLoadWorkflow = async (template: TemplateInfo) => {
  loadingTemplate.value = template.name
  try {
    await loadWorkflowTemplate(
      template.name,
      getEffectiveSourceModule(template)
    )
    templateWasSelected.value = true
    onClose()
  } finally {
    loadingTemplate.value = null
  }
}

const pageTitle = computed(() => {
  const navItem = navItems.value.find((item) =>
    'id' in item
      ? item.id === selectedNavItem.value
      : item.items?.some((sub) => sub.id === selectedNavItem.value)
  )

  if (!navItem) {
    return t('templateWorkflows.allTemplates', 'All Templates')
  }

  return 'id' in navItem
    ? navItem.label
    : navItem.items?.find((i) => i.id === selectedNavItem.value)?.label ||
        t('templateWorkflows.allTemplates', 'All Templates')
})

// Initialize templates loading with useAsyncState
const { isLoading } = useAsyncState(
  async () => {
    await Promise.all([
      loadTemplates(),
      workflowTemplatesStore.loadWorkflowTemplates(),
      loadFuseOptions()
    ])
    return true
  },
  false, // initial state
  {
    immediate: true // Start loading immediately
  }
)
</script>
