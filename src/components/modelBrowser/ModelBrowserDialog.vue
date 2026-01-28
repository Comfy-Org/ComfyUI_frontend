<template>
  <BaseModalLayout
    v-model:right-panel-open="isRightPanelOpen"
    data-component-id="ModelBrowserDialog"
    class="size-full max-h-full max-w-full min-w-0"
    :content-title="$t('modelBrowser.title')"
    :right-panel-title="$t('modelBrowser.modelInfo')"
    @close="handleClose"
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
        :placeholder="$t('modelBrowser.searchPlaceholder')"
        class="max-w-96"
      />
    </template>

    <template #header-right-area>
      <ViewModeToggle v-model="viewMode" />
    </template>

    <template #contentFilter>
      <ModelBrowserFilterBar
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
import { computed, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/common/SearchBox.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useModelBrowserFiltering } from '@/composables/useModelBrowserFiltering'
import { useModelFilterOptions } from '@/composables/useModelFilterOptions'
import { useModelKeyboardNav } from '@/composables/useModelKeyboardNav'
import { useModelLoader } from '@/composables/useModelLoader'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import { useTelemetry } from '@/platform/telemetry'
import type { ComfyModelDef } from '@/stores/modelStore'
import type { EnrichedModel } from '@/types/modelBrowserTypes'
import type { NavGroupData } from '@/types/navTypes'

import ModelBrowserStates from './ModelBrowserStates.vue'
import ModelCard from './ModelCard.vue'
import ModelListItem from './ModelListItem.vue'
import LocalModelInfoPanel from './LocalModelInfoPanel.vue'
import ModelBrowserFilterBar from './ModelBrowserFilterBar.vue'
import ViewModeToggle from './ViewModeToggle.vue'
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

const { modelTypes, fetchModelTypes } = useModelTypes()

const {
  searchQuery,
  selectedModelType,
  selectedFileFormats,
  selectedModelTypes,
  sortBy,
  sortDirection,
  filteredModels,
  clearFilters
} = useModelBrowserFiltering(models, {
  searchDebounce: 300
})

const { availableFileFormats, availableModelTypes } =
  useModelFilterOptions(models)

const sortOptions = computed<SortOption[]>(() => [
  { label: t('modelBrowser.sortByName'), value: 'name' },
  { label: t('modelBrowser.sortBySize'), value: 'size' },
  { label: t('modelBrowser.sortByDate'), value: 'modified' }
])

const gridItems = computed(() =>
  filteredModels.value.map((model) => ({
    key: model.id,
    model
  }))
)

const gridStyle = computed<CSSProperties>(() => {
  if (viewMode.value === 'list') {
    return {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      padding: '1.5rem'
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
          icon: 'icon-[comfy--ai-model]'
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
  } else {
    selectedModelType.value = newValue
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
  // Track dialog closed
  telemetry?.trackUiButtonClicked({
    button_id: 'model_browser_closed'
  })

  emit('close')
}

function handleModelFocus(model: EnrichedModel) {
  focusedModel.value = model
}

function handleModelSelect(_model: EnrichedModel) {
  // Track model selection
  telemetry?.trackUiButtonClicked({
    button_id: 'model_browser_model_selected'
  })

  emit('select', _model.original)
}

function handleShowInfo(model: EnrichedModel) {
  focusedModel.value = model
  isRightPanelOpen.value = true
}
</script>
