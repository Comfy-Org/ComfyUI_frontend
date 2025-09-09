<template>
  <BaseWidgetLayout
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
      <SearchBox v-model="searchQuery" class="max-w-[384px]" />
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
            <i-lucide:filter-x />
          </template>
        </IconTextButton>
      </div>
    </template>

    <template #contentFilter>
      <div class="relative px-6 pt-2 pb-4 flex gap-2 flex-wrap">
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
            <i-lucide:cpu />
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
            <i-lucide:target />
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
            <i-lucide:file-text />
          </template>
        </MultiSelect>

        <!-- Sort Options -->
        <div class="absolute right-5">
          <SingleSelect
            v-model="sortBy"
            :label="$t('templateWorkflows.sorting', 'Sort by')"
            :options="sortOptions"
            class="min-w-[270px]"
          >
            <template #icon>
              <i-lucide:arrow-up-down />
            </template>
          </SingleSelect>
        </div>
      </div>
    </template>

    <template #content>
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center h-64">
        <div class="text-neutral-500">
          {{ $t('templateWorkflows.loading', 'Loading templates...') }}
        </div>
      </div>

      <!-- No Results State -->
      <div
        v-else-if="filteredTemplates.length === 0 && !isLoading"
        class="flex flex-col items-center justify-center h-64 text-neutral-500"
      >
        <i-lucide:search class="w-12 h-12 mb-4 opacity-50" />
        <p class="text-lg mb-2">
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
        <div class="px-6 pt-4 pb-2 text-2xl font-semibold text-neutral">
          <!-- show selected nav -->
          <span>
            {{ pageTitle }}
          </span>
        </div>

        <!-- Template Cards Grid -->
        <div
          class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-x-4 gap-y-6 px-4 py-4"
        >
          <CardContainer
            v-for="template in displayTemplates"
            :key="template.name"
            ref="cardRefs"
            ratio="none"
            :max-width="300"
            :min-width="200"
            class="cursor-pointer transition-all duration-300 hover:scale-[1.02]"
            @mouseenter="hoveredTemplates[template.name] = true"
            @mouseleave="hoveredTemplates[template.name] = false"
            @click="onLoadWorkflow(template)"
          >
            <template #top>
              <CardTop ratio="landscape">
                <template #default>
                  <!-- Template Thumbnail -->
                  <div class="w-full h-full relative">
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
                        :is-hovered="hoveredTemplates[template.name]"
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
                        :is-hovered="hoveredTemplates[template.name]"
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
                        :is-hovered="hoveredTemplates[template.name]"
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
                      class="absolute inset-0 z-10 w-12 h-12 m-auto"
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
                  <template v-else>
                    <SquareChip
                      v-if="template.mediaType"
                      :label="template.mediaType"
                    />
                    <SquareChip
                      v-if="template.models && template.models.length > 0"
                      :label="template.models[0]"
                    />
                  </template>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom :full-height="false">
                <div class="flex flex-col px-4 flex-1">
                  <div class="flex-1">
                    <h3
                      class="line-clamp-2 text-lg font-normal mb-1"
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
                      <p
                        class="line-clamp-2 text-sm text-muted mb-3"
                        :title="getTemplateDescription(template)"
                      >
                        {{ getTemplateDescription(template) }}
                      </p>
                      <div
                        v-if="template.tutorialUrl"
                        class="flex flex-col-reverse justify-center"
                      >
                        <button
                          v-tooltip.bottom="$t('g.seeTutorial')"
                          :class="[
                            'inline-flex items-center justify-center rounded-lg bg-[#FDFBFA] w-8 h-8 cursor-pointer transition-opacity duration-200',
                            hoveredTemplates[template.name]
                              ? 'opacity-100'
                              : 'opacity-0 pointer-events-none'
                          ]"
                          @click.stop="openTutorial(template)"
                        >
                          <i class="icon-[comfy--dark-info] w-4 h-4" />
                        </button>
                      </div>
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
            ratio="square"
            :max-width="300"
            :min-width="200"
          >
            <template #top>
              <CardTop ratio="landscape">
                <template #default>
                  <div
                    class="w-full h-full bg-neutral-200 dark-theme:bg-neutral-700 animate-pulse"
                  ></div>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom>
                <div class="px-4 py-3">
                  <div
                    class="h-6 bg-neutral-200 dark-theme:bg-neutral-700 rounded animate-pulse mb-2"
                  ></div>
                  <div
                    class="h-4 bg-neutral-200 dark-theme:bg-neutral-700 rounded animate-pulse"
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
        class="w-full h-4 flex justify-center items-center mt-4"
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
  </BaseWidgetLayout>
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

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
import BaseWidgetLayout from '@/components/widget/layout/BaseWidgetLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { useLazyPagination } from '@/composables/useLazyPagination'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import { useTemplateWorkflows } from '@/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/stores/workflowTemplatesStore'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'

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

const getEffectiveSourceModule = (template: any) =>
  template.sourceModule || 'default'

const getBaseThumbnailSrc = (template: any) => {
  const sm = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(template, sm, sm === 'default' ? '1' : '')
}

const getOverlayThumbnailSrc = (template: any) => {
  const sm = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(template, sm, sm === 'default' ? '2' : '')
}

// Open tutorial in new tab
const openTutorial = (template: any) => {
  if (template.tutorialUrl) {
    window.open(template.tutorialUrl, '_blank')
  }
}

// Get navigation items from the store
const navItems = computed<(NavItemData | NavGroupData)[]>(() => {
  return workflowTemplatesStore.navGroupedTemplates
})

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
const isLoading = ref(true)
const loadingTemplate = ref<string | null>(null)
const hoveredTemplates = ref<Record<string, boolean>>({})
const cardRefs = ref<HTMLElement[]>([])

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
    name: t(
      'templateWorkflows.sort.vramLowToHigh',
      'VRAM Utilization (Low to High)'
    ),
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

// Initialize
onMounted(async () => {
  await loadTemplates()
  await workflowTemplatesStore.loadWorkflowTemplates()
  isLoading.value = false
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
