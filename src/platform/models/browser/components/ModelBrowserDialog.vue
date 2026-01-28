<template>
  <BaseModalLayout
    v-model:right-panel-open="isRightPanelOpen"
    data-component-id="ModelBrowserDialog"
    class="size-full max-h-full max-w-full min-w-0 model-browser-layout"
    :content-title="$t('modelBrowser.title')"
    :right-panel-title="$t('modelBrowser.modelInfo')"
  >
    <template #leftPanelHeaderTitle>
      <i class="icon-[comfy--ai-model] size-4" />
      <h2 class="flex-auto select-none text-base font-semibold text-nowrap">
        {{ $t('modelBrowser.title') }}
      </h2>
    </template>

    <template #leftPanel>
      <LeftSidePanel
        v-model="selectedNavItem"
        data-component-id="ModelBrowserDialog-LeftSidePanel"
        :nav-items="navItems"
      />
    </template>

    <template #header>
      <SearchBox
        v-model="searchQuery"
        :autofocus="true"
        size="lg"
        :placeholder="$t('g.search')"
        class="hidden md:block max-w-96"
      />
    </template>

    <template #contentFilter>
      <!-- Mobile search row -->
      <div
        class="flex md:hidden items-center gap-2 px-3 sm:px-6 pt-3 pb-2"
        data-component-id="mobile-search-row"
      >
        <SearchBox
          v-model="searchQuery"
          :autofocus="true"
          size="lg"
          :placeholder="$t('g.search')"
          class="flex-1"
        />
      </div>

      <!-- Filter bar -->
      <ModelBrowserFilterBar
        v-model:view-mode="viewMode"
        :available-file-formats="availableFileFormats"
        :available-model-types="availableModelTypes"
        :selected-file-formats="selectedFileFormats"
        :selected-model-types="selectedModelTypes"
        :sort-by="sortBy"
        :sort-direction="sortDirection"
        :sort-options="sortOptions"
        @update:selected-file-formats="selectedFileFormats = $event"
        @update:selected-model-types="selectedModelTypes = $event"
        @update:sort-by="sortBy = $event"
        @update:sort-direction="sortDirection = $event"
      />
    </template>

    <template #content>
      <ModelBrowserStates
        :is-loading="isLoading"
        :error="error"
        :is-empty="filteredModels.length === 0"
        :empty-message="
          searchQuery ||
          selectedFileFormats.length > 0 ||
          selectedModelTypes.length > 0
            ? $t('modelBrowser.noModelsForFilter')
            : $t('modelBrowser.noModels')
        "
        :show-clear-filters="
          !!(
            searchQuery ||
            selectedFileFormats.length > 0 ||
            selectedModelTypes.length > 0
          )
        "
        @retry="retryLoad"
        @clear-filters="clearFilters"
      >
        <!-- Table Header for List View -->
        <div
          v-if="viewMode === 'list'"
          class="grid grid-cols-[48px_1fr_120px_120px_100px_100px_40px] gap-4 items-center px-4 py-2 bg-table-header-background border-b border-border-default sticky top-0 z-10"
        >
          <div></div>
          <!-- Thumbnail column -->
          <div class="text-xs font-medium text-muted-foreground">
            {{ $t('modelBrowser.columns.modelName') }}
          </div>
          <div class="text-xs font-medium text-muted-foreground">
            {{ $t('modelBrowser.columns.baseModel') }}
          </div>
          <div class="text-xs font-medium text-muted-foreground">
            {{ $t('modelBrowser.columns.modelType') }}
          </div>
          <div class="text-xs font-medium text-muted-foreground">
            {{ $t('modelBrowser.columns.fileSize') }}
          </div>
          <div class="text-xs font-medium text-muted-foreground">
            {{ $t('modelBrowser.columns.dateModified') }}
          </div>
          <div></div>
          <!-- Actions column -->
        </div>
        <VirtualGrid
          :items="gridItems"
          :grid-style="gridStyle"
          :default-item-height="
            viewMode === 'grid'
              ? GRID_ITEM_DEFAULT_HEIGHT
              : LIST_ITEM_DEFAULT_HEIGHT
          "
          :default-item-width="
            viewMode === 'grid' ? GRID_ITEM_DEFAULT_WIDTH : 0
          "
          :buffer-rows="VIRTUAL_GRID_BUFFER_ROWS"
          role="grid"
          :aria-label="$t('modelBrowser.title')"
          class="flex-1"
        >
          <template #item="{ item }">
            <ModelCard
              v-if="viewMode === 'grid'"
              role="gridcell"
              :model="item.model"
              :focused="focusedModel?.id === item.model.id"
              @focus="handleModelFocus"
              @select="handleModelSelect"
              @show-info="handleShowInfo"
            />
            <ModelListItem
              v-else
              role="row"
              :model="item.model"
              :row-index="item.index"
              :focused="focusedModel?.id === item.model.id"
              @focus="handleModelFocus"
              @select="handleModelSelect"
              @show-info="handleShowInfo"
            />
          </template>
        </VirtualGrid>
      </ModelBrowserStates>
    </template>

    <template #rightPanel>
      <LocalModelInfoPanel
        v-if="focusedModel"
        :model="focusedModel"
        @use="handleModelSelect"
      />
      <div
        v-else
        class="flex h-full items-center justify-center break-words p-6 text-center text-muted-foreground"
      >
        {{ $t('modelBrowser.selectModelToViewInfo') }}
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/common/SearchBox.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useModelBrowserFiltering } from '@/platform/models/browser/composables/useModelBrowserFiltering'
import { useModelFilterOptions } from '@/platform/models/browser/composables/useModelFilterOptions'
import { useModelKeyboardNav } from '@/platform/models/browser/composables/useModelKeyboardNav'
import { useModelLoader } from '@/platform/models/browser/composables/useModelLoader'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import { useModelBookmarks } from '@/platform/models/browser/composables/useModelBookmarks'
import { useTelemetry } from '@/platform/telemetry'
import type { ComfyModelDef } from '@/stores/modelStore'
import type { EnrichedModel } from '@/platform/models/browser/types/modelBrowserTypes'
import type { NavGroupData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'
import { createModelNode } from '@/platform/models/browser/utils/createModelNode'

import ModelBrowserStates from './ModelBrowserStates.vue'
import ModelCard from './ModelCard.vue'
import ModelListItem from './ModelListItem.vue'
import LocalModelInfoPanel from './LocalModelInfoPanel.vue'
import ModelBrowserFilterBar from './ModelBrowserFilterBar.vue'
import type { SortOption } from './ModelBrowserSortButton.vue'

const { t } = useI18n()
const telemetry = useTelemetry()

const emit = defineEmits<{
  select: [model: ComfyModelDef]
  close: []
}>()

// Virtual grid configuration constants
const GRID_ITEM_DEFAULT_HEIGHT = 260
const LIST_ITEM_DEFAULT_HEIGHT = 100
const GRID_ITEM_DEFAULT_WIDTH = 180
const GRID_MIN_COLUMN_WIDTH = 180
const VIRTUAL_GRID_BUFFER_ROWS = 2

const { isLoading, error, models, loadModels, retryLoad } = useModelLoader()

const focusedModel = ref<EnrichedModel | null>(null)
const selectedNavItem = ref<string>('all')
const isRightPanelOpen = ref(false)
const viewMode = ref<'grid' | 'list'>('grid')
const showOnlyBookmarked = ref(false)

const { modelTypes, fetchModelTypes } = useModelTypes()
const { filterBookmarkedModels, bookmarkCount } = useModelBookmarks()

const {
  searchQuery,
  selectedModelType,
  selectedFileFormats,
  selectedModelTypes,
  sortBy,
  sortDirection,
  filteredModels: baseFilteredModels,
  clearFilters
} = useModelBrowserFiltering(models, {
  searchDebounce: 300
})

// Apply bookmark filter on top of base filters
const filteredModels = computed(() => {
  if (showOnlyBookmarked.value) {
    return filterBookmarkedModels(baseFilteredModels.value)
  }
  return baseFilteredModels.value
})

const { availableFileFormats, availableModelTypes } =
  useModelFilterOptions(models)

const sortOptions = computed<SortOption[]>(() => [
  { label: t('assetBrowser.sortRecent'), value: 'modified' },
  { label: t('assetBrowser.sortAZ'), value: 'name' },
  { label: t('modelBrowser.sortBySize'), value: 'size' }
])

const gridItems = computed(() =>
  filteredModels.value.map((model, index) => ({
    key: model.id,
    model,
    index
  }))
)

const gridStyle = computed<CSSProperties>(() => {
  if (viewMode.value === 'list') {
    return {
      display: 'flex',
      flexDirection: 'column',
      gap: '0'
    }
  }
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_COLUMN_WIDTH}px, 1fr))`,
    gap: '1rem',
    padding: '1.5rem'
  }
})

const navItems = computed<NavGroupData[]>(() => {
  const typeItems =
    modelTypes.value?.map((type) => ({
      id: type.value,
      label: type.name,
      icon: 'icon-[lucide--folder]'
    })) || []

  return [
    {
      title: '',
      collapsible: false,
      items: [
        {
          id: 'all',
          label: t('modelBrowser.allModels'),
          icon: 'icon-[lucide--list]'
        },
        {
          id: 'bookmarked',
          label: `${t('modelBrowser.bookmarked')} (${bookmarkCount.value})`,
          icon: 'icon-[lucide--bookmark]'
        }
      ]
    },
    {
      title: t('modelBrowser.filterByType'),
      collapsible: false,
      items: typeItems
    }
  ]
})

watch(selectedNavItem, (newValue) => {
  if (newValue === 'all') {
    selectedModelType.value = null
    showOnlyBookmarked.value = false
  } else if (newValue === 'bookmarked') {
    selectedModelType.value = null
    showOnlyBookmarked.value = true
  } else {
    selectedModelType.value = newValue
    showOnlyBookmarked.value = false
  }
})

// Track search queries - only fire once when search starts
watch(searchQuery, (newQuery, oldQuery) => {
  const searchStarted = !oldQuery && newQuery
  if (searchStarted) {
    telemetry?.trackUiButtonClicked({
      button_id: 'model_browser_search'
    })
  }
})

// Track filter changes - any filter type
watch([selectedModelType, selectedFileFormats, selectedModelTypes], () => {
  telemetry?.trackUiButtonClicked({
    button_id: 'model_browser_filter_applied'
  })
})

// Keyboard navigation
useModelKeyboardNav(gridItems, focusedModel, isRightPanelOpen, viewMode, {
  onShowInfo: handleShowInfo,
  onClose: handleClose
})

onMounted(() => {
  loadModels()
  fetchModelTypes()

  // Track dialog opened
  telemetry?.trackUiButtonClicked({
    button_id: 'model_browser_opened'
  })
})

function handleClose() {
  // If right panel is open, close it first
  if (isRightPanelOpen.value) {
    isRightPanelOpen.value = false
    return
  }

  // Otherwise, close the dialog
  // Track dialog closed
  telemetry?.trackUiButtonClicked({
    button_id: 'model_browser_closed'
  })

  emit('close')
}

// Provide close handler for BaseModalLayout
provide(OnCloseKey, handleClose)

function handleModelFocus(model: EnrichedModel) {
  focusedModel.value = model
}

function handleModelSelect(model: EnrichedModel) {
  // Track model selection
  telemetry?.trackUiButtonClicked({
    button_id: 'model_browser_model_selected'
  })

  // Create node on canvas
  const result = createModelNode(model)

  if (result.success) {
    // Emit legacy select event for backward compatibility
    emit('select', model.original)
    // Close dialog after successful node creation
    handleClose()
  } else {
    // Log error - error details already logged by createModelNode
    console.error(
      `Failed to create node for model ${model.displayName}:`,
      result.error.message
    )
    // Don't close dialog on error so user can try again
  }
}

function handleShowInfo(model: EnrichedModel) {
  focusedModel.value = model
  isRightPanelOpen.value = true
}
</script>
