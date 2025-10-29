<template>
  <BaseModalLayout
    :content-title="$t('templateWorkflows.title', 'Workflow Templates')"
    class="workflow-template-selector-dialog"
  >
    <template #leftPanel>
      <LeftSidePanel v-model="selectedNavItem" :nav-items="navItems">
        <template #header-icon>
          <i class="icon-[comfy--template]" />
        </template>
        <template #header-title>
          <span class="text-neutral text-base">{{
            $t('sideToolbar.templates', 'Templates')
          }}</span>
        </template>
      </LeftSidePanel>
    </template>

    <template #header>
      <SearchBox v-model="searchQuery" size="lg" class="max-w-[384px]" />
    </template>

    <template #header-right-area>
      <div class="flex gap-2">
        <IconTextButton
          v-if="filteredCount !== totalCount"
          type="secondary"
          :label="$t('templateWorkflows.resetFilters', 'Clear Filters')"
          @click="resetFilters"
        >
          <template #icon>
            <i class="icon-[lucide--filter-x]" />
          </template>
        </IconTextButton>
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

          <!-- License Filter -->
          <MultiSelect
            v-model="selectedLicenseObjects"
            :label="licenseFilterLabel"
            :options="licenseOptions"
            :show-search-box="true"
            :show-selected-count="true"
            :show-clear-button="true"
          >
            <template #icon>
              <i class="icon-[lucide--file-text]" />
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
              <i class="icon-[lucide--arrow-up-down]" />
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
        <i class="mb-4 icon-[lucide--search] h-12 w-12 opacity-50" />
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
          class="inline-block h-8 w-48 animate-pulse rounded bg-dialog-surface"
        ></span>

        <!-- Template Cards Grid -->
        <div
          :key="templateListKey"
          :style="gridStyle"
          data-testid="template-workflows-content"
        >
          <!-- Loading Skeletons (show while loading initial data) -->
          <CardContainer
            v-for="n in isLoading ? 12 : 0"
            :key="`initial-skeleton-${n}`"
            size="compact"
            variant="ghost"
            rounded="lg"
            class="hover:bg-base-background"
          >
            <template #top>
              <CardTop ratio="landscape">
                <template #default>
                  <div
                    class="h-full w-full animate-pulse bg-dialog-surface"
                  ></div>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom>
                <div class="px-4 py-3">
                  <div
                    class="mb-2 h-6 animate-pulse rounded bg-dialog-surface"
                  ></div>
                  <div
                    class="h-4 animate-pulse rounded bg-dialog-surface"
                  ></div>
                </div>
              </CardBottom>
            </template>
          </CardContainer>

          <!-- Actual Template Cards -->
          <CardContainer
            v-for="template in isLoading ? [] : displayTemplates"
            :key="template.name"
            ref="cardRefs"
            size="compact"
            variant="ghost"
            rounded="lg"
            :data-testid="`template-workflow-${template.name}`"
            class="hover:bg-base-background"
            @mouseenter="hoveredTemplate = template.name"
            @mouseleave="hoveredTemplate = null"
            @click="onLoadWorkflow(template)"
          >
            <template #top>
              <CardTop ratio="square">
                <template #default>
                  <!-- Template Thumbnail -->
                  <div
                    class="relative h-full w-full overflow-hidden rounded-lg"
                  >
                    <template v-if="template.mediaType === 'audio'">
                      <AudioThumbnail :src="getBaseThumbnailSrc(template)" />
                    </template>
                    <template
                      v-else-if="template.thumbnailVariant === 'compareSlider'"
                    >
                      <CompareSliderThumbnail
                        :base-image-src="getBaseThumbnailSrc(template)"
                        :overlay-image-src="getOverlayThumbnailSrc(template)"
                        :alt="
                          getTemplateTitle(
                            template,
                            getEffectiveSourceModule(template)
                          )
                        "
                        :is-hovered="hoveredTemplate === template.name"
                        :is-video="
                          template.mediaType === 'video' ||
                          template.mediaSubtype === 'webp'
                        "
                      />
                    </template>
                    <template
                      v-else-if="template.thumbnailVariant === 'hoverDissolve'"
                    >
                      <HoverDissolveThumbnail
                        :base-image-src="getBaseThumbnailSrc(template)"
                        :overlay-image-src="getOverlayThumbnailSrc(template)"
                        :alt="
                          getTemplateTitle(
                            template,
                            getEffectiveSourceModule(template)
                          )
                        "
                        :is-hovered="hoveredTemplate === template.name"
                        :is-video="
                          template.mediaType === 'video' ||
                          template.mediaSubtype === 'webp'
                        "
                      />
                    </template>
                    <template v-else>
                      <DefaultThumbnail
                        :src="getBaseThumbnailSrc(template)"
                        :alt="
                          getTemplateTitle(
                            template,
                            getEffectiveSourceModule(template)
                          )
                        "
                        :is-hovered="hoveredTemplate === template.name"
                        :is-video="
                          template.mediaType === 'video' ||
                          template.mediaSubtype === 'webp'
                        "
                        :hover-zoom="
                          template.thumbnailVariant === 'zoomHover' ? 16 : 5
                        "
                      />
                    </template>
                    <ProgressSpinner
                      v-if="loadingTemplate === template.name"
                      class="absolute inset-0 z-10 m-auto h-12 w-12"
                    />
                  </div>
                </template>
                <template #bottom-right>
                  <template v-if="template.tags && template.tags.length > 0">
                    <SquareChip
                      v-for="tag in template.tags"
                      :key="tag"
                      :label="tag"
                    />
                  </template>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom>
                <div class="flex flex-col gap-2 pt-3">
                  <h3
                    class="m-0 line-clamp-1 text-sm"
                    :title="
                      getTemplateTitle(
                        template,
                        getEffectiveSourceModule(template)
                      )
                    "
                  >
                    {{
                      getTemplateTitle(
                        template,
                        getEffectiveSourceModule(template)
                      )
                    }}
                  </h3>
                  <div class="flex justify-between gap-2">
                    <div class="flex-1">
                      <p
                        class="m-0 line-clamp-2 text-sm text-muted"
                        :title="getTemplateDescription(template)"
                      >
                        {{ getTemplateDescription(template) }}
                      </p>
                    </div>
                    <div
                      v-if="template.tutorialUrl"
                      class="flex flex-col-reverse justify-center"
                    >
                      <IconButton
                        v-if="hoveredTemplate === template.name"
                        v-tooltip.bottom="$t('g.seeTutorial')"
                        v-bind="$attrs"
                        type="primary"
                        size="sm"
                        @click.stop="openTutorial(template)"
                      >
                        <i class="icon-[lucide--info] size-4" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </CardBottom>
            </template>
          </CardContainer>

          <!-- Loading More Skeletons -->
          <CardContainer
            v-for="n in isLoadingMore ? 6 : 0"
            :key="`skeleton-${n}`"
            size="compact"
            variant="ghost"
            rounded="lg"
            class="hover:bg-base-background"
          >
            <template #top>
              <CardTop ratio="square">
                <template #default>
                  <div
                    class="h-full w-full animate-pulse bg-dialog-surface"
                  ></div>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom>
                <div class="px-4 py-3">
                  <div
                    class="mb-2 h-6 animate-pulse rounded bg-dialog-surface"
                  ></div>
                  <div
                    class="h-4 animate-pulse rounded bg-dialog-surface"
                  ></div>
                </div>
              </CardBottom>
            </template>
          </CardContainer>
        </div>
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
      <div
        v-if="!isLoading"
        class="mt-6 px-6 text-sm text-neutral-600 dark-theme:text-neutral-400"
      >
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
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import IconButton from '@/components/button/IconButton.vue'
import IconTextButton from '@/components/button/IconTextButton.vue'
import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import MultiSelect from '@/components/input/MultiSelect.vue'
import SearchBox from '@/components/input/SearchBox.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { useLazyPagination } from '@/composables/useLazyPagination'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'
import { createGridStyle } from '@/utils/gridUtil'

const { t } = useI18n()

const { onClose } = defineProps<{
  onClose: () => void
}>()

provide(OnCloseKey, onClose)

// Workflow templates store and composable
const workflowTemplatesStore = useWorkflowTemplatesStore()
const {
  loadTemplates,
  loadWorkflowTemplate,
  getTemplateThumbnailUrl,
  getTemplateTitle,
  getTemplateDescription
} = useTemplateWorkflows()

const getEffectiveSourceModule = (template: TemplateInfo) =>
  template.sourceModule || 'default'

const getBaseThumbnailSrc = (template: TemplateInfo) => {
  const sm = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(template, sm, sm === 'default' ? '1' : '')
}

const getOverlayThumbnailSrc = (template: TemplateInfo) => {
  const sm = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(template, sm, sm === 'default' ? '2' : '')
}

// Open tutorial in new tab
const openTutorial = (template: TemplateInfo) => {
  if (template.tutorialUrl) {
    window.open(template.tutorialUrl, '_blank')
  }
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

const gridStyle = computed(() => createGridStyle())

// Get enhanced templates for better filtering
const allTemplates = computed(() => {
  return workflowTemplatesStore.enhancedTemplates
})

// Filter templates based on selected navigation item
const navigationFilteredTemplates = computed(() => {
  if (!selectedNavItem.value) {
    return allTemplates.value
  }

  return workflowTemplatesStore.filterTemplatesByCategory(selectedNavItem.value)
})

// Template filtering
const {
  searchQuery,
  selectedModels,
  selectedUseCases,
  selectedLicenses,
  sortBy,
  filteredTemplates,
  availableModels,
  availableUseCases,
  availableLicenses,
  filteredCount,
  totalCount,
  resetFilters
} = useTemplateFiltering(navigationFilteredTemplates)

// Convert between string array and object array for MultiSelect component
const selectedModelObjects = computed({
  get() {
    return selectedModels.value.map((model) => ({ name: model, value: model }))
  },
  set(value: { name: string; value: string }[]) {
    selectedModels.value = value.map((item) => item.value)
  }
})

const selectedUseCaseObjects = computed({
  get() {
    return selectedUseCases.value.map((useCase) => ({
      name: useCase,
      value: useCase
    }))
  },
  set(value: { name: string; value: string }[]) {
    selectedUseCases.value = value.map((item) => item.value)
  }
})

const selectedLicenseObjects = computed({
  get() {
    return selectedLicenses.value.map((license) => ({
      name: license,
      value: license
    }))
  },
  set(value: { name: string; value: string }[]) {
    selectedLicenses.value = value.map((item) => item.value)
  }
})

// Loading states
const loadingTemplate = ref<string | null>(null)
const hoveredTemplate = ref<string | null>(null)
const cardRefs = ref<HTMLElement[]>([])

// Force re-render key for templates when sorting changes
const templateListKey = ref(0)

// Navigation
const selectedNavItem = ref<string | null>('all')

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

const licenseOptions = computed(() =>
  availableLicenses.value.map((license) => ({
    name: license,
    value: license
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

const licenseFilterLabel = computed(() => {
  if (selectedLicenseObjects.value.length === 0) {
    return t('templateWorkflows.licenseFilter', 'License')
  } else if (selectedLicenseObjects.value.length === 1) {
    return selectedLicenseObjects.value[0].name
  } else {
    return t('templateWorkflows.licensesSelected', {
      count: selectedLicenseObjects.value.length
    })
  }
})

// Sort options
const sortOptions = computed(() => [
  { name: t('templateWorkflows.sort.newest', 'Newest'), value: 'newest' },
  {
    name: t('templateWorkflows.sort.default', 'Default'),
    value: 'default'
  },
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
    searchQuery,
    selectedNavItem,
    sortBy,
    selectedModels,
    selectedUseCases,
    selectedLicenses
  ],
  () => {
    resetPagination()
    // Clear loading state and force re-render of template list
    loadingTemplate.value = null
    templateListKey.value++
  }
)

// Methods
const onLoadWorkflow = async (template: any) => {
  loadingTemplate.value = template.name
  try {
    await loadWorkflowTemplate(
      template.name,
      getEffectiveSourceModule(template)
    )
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
    // Run both operations in parallel for better performance
    await Promise.all([
      loadTemplates(),
      workflowTemplatesStore.loadWorkflowTemplates()
    ])
    return true
  },
  false, // initial state
  {
    immediate: true // Start loading immediately
  }
)

onBeforeUnmount(() => {
  cardRefs.value = [] // Release DOM refs
})
</script>

<style>
/* Ensure the workflow template selector dialog fits within provided dialog */
.workflow-template-selector-dialog.base-widget-layout {
  width: 100% !important;
  max-width: 1400px;
  height: 100% !important;
  aspect-ratio: auto !important;
}

@media (min-width: 1600px) {
  .workflow-template-selector-dialog.base-widget-layout {
    max-width: 1600px;
  }
}
</style>
