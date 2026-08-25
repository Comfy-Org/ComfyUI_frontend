<template>
  <BaseModalLayout
    :content-title="$t('templateWorkflows.title', 'Workflow Templates')"
    content-padding="none"
    size="md"
    close-button-variant="textonly"
  >
    <template #leftPanelHeaderTitle>
      <i class="icon-[comfy--template]" />
      <h2 class="text-neutral text-base font-semibold">
        {{ $t('sideToolbar.templates', 'Templates') }}
      </h2>
    </template>
    <template #leftPanel>
      <LeftSidePanel
        :model-value="selectedNavItem"
        :nav-items="navItems"
        @update:model-value="onSelectNavItem"
      />
    </template>

    <template #header>
      <nav
        v-if="activeDetail"
        :aria-label="$t('templateWorkflows.detail.breadcrumbLabel')"
        class="flex min-w-0 flex-1 items-center gap-2"
      >
        <Button
          :aria-label="
            $t('templateWorkflows.detail.backToTemplates', {
              category: pageTitle
            })
          "
          :disabled="openPending"
          size="unset"
          variant="muted-textonly"
          class="shrink-0 gap-2 text-sm font-medium text-muted-foreground hover:bg-transparent"
          @click="onBackToTemplates"
        >
          <i aria-hidden="true" class="icon-[lucide--arrow-left] size-4" />
          {{ pageTitle }}
        </Button>
      </nav>
      <div v-else class="flex min-w-0 flex-1 items-center gap-2">
        <h2
          class="text-neutral m-0 hidden shrink-0 truncate text-base font-medium min-[880px]:block"
        >
          {{ pageTitle }}
        </h2>
        <AsyncSearchInput
          v-model="searchInput"
          :searcher="applySearchQuery"
          :debounce-ms="400"
          :debounce-max-wait-ms="4000"
          class="h-9 w-full min-w-0 flex-1 border border-border-subtle bg-transparent min-[880px]:ml-auto min-[880px]:max-w-96"
          autofocus
        />
      </div>
    </template>

    <template #contentFilter>
      <div
        v-if="!activeDetail"
        :class="
          cn(
            '@container/filters relative px-6',
            hasActiveFilters ? 'pb-2' : 'pb-4'
          )
        "
        data-testid="template-filter-bar"
      >
        <div class="flex items-center gap-3">
          <div class="flex min-w-0 shrink items-center gap-2">
            <Button
              v-for="tab in typeTabs"
              :key="tab.value"
              size="md"
              :variant="selectedType === tab.value ? 'inverted' : 'secondary'"
              :aria-pressed="selectedType === tab.value"
              :aria-label="tab.icon ? tab.label : undefined"
              class="h-8 shrink-0 px-3 text-xs @max-[30rem]/filters:px-2.5"
              @click="selectedType = tab.value"
            >
              <i v-if="tab.icon" :class="cn(tab.icon, 'size-3.5')" />
              <span :class="cn(tab.icon && '@max-[30rem]/filters:sr-only')">{{
                tab.label
              }}</span>
            </Button>
          </div>

          <div
            class="ml-auto hidden min-w-0 shrink items-center justify-end gap-2 @[58rem]/filters:flex"
          >
            <TemplateFilterControls
              v-bind="filterControlBindings"
              trigger-class="min-w-0 shrink basis-40 border border-border-subtle bg-transparent"
            />
          </div>

          <Button
            size="md"
            :variant="mobileFiltersOpen ? 'inverted' : 'secondary'"
            :aria-expanded="mobileFiltersOpen"
            aria-controls="template-mobile-filters"
            :aria-label="$t('templateWorkflows.filtersButton')"
            class="ml-auto h-8 shrink-0 px-3 text-xs @[58rem]/filters:hidden"
            @click="mobileFiltersOpen = !mobileFiltersOpen"
          >
            <i class="icon-[lucide--sliders-horizontal] size-3.5" />
            <span>{{ $t('templateWorkflows.filtersButton') }}</span>
            <span v-if="activeFilterCount > 0" :class="selectCountBadgeClass">
              {{ activeFilterCount }}
            </span>
          </Button>
        </div>

        <div
          v-show="mobileFiltersOpen"
          id="template-mobile-filters"
          class="mt-3 flex flex-col gap-2 @[58rem]/filters:hidden"
        >
          <div class="grid grid-cols-2 gap-2 @max-[26rem]/filters:grid-cols-1">
            <TemplateFilterControls
              v-bind="filterControlBindings"
              trigger-class="w-full border border-border-subtle bg-transparent"
            />
          </div>
        </div>

        <div v-if="hasActiveFilters" class="flex items-center pt-5">
          <span
            v-if="activeFilterCount > 0"
            class="text-xs font-medium text-muted-foreground"
          >
            {{
              $t('templateWorkflows.filtersApplied', {
                count: activeFilterCount
              })
            }}
          </span>
          <Button
            variant="link"
            size="unset"
            class="ml-auto text-xs font-normal text-base-foreground underline opacity-70 hover:opacity-100"
            @click="resetFilters"
          >
            {{ $t('templateWorkflows.clearAllFilters') }}
          </Button>
        </div>
      </div>
    </template>

    <template #content>
      <!-- No Results State (only show when loaded and no results) -->
      <div
        v-if="!activeDetail && !isLoading && filteredTemplates.length === 0"
        class="flex h-64 flex-col items-center justify-center px-6 text-neutral-500"
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
      <div v-else v-show="!activeDetail" class="px-6">
        <!-- Title -->
        <span
          v-if="isLoading"
          class="inline-block h-8 w-48 animate-pulse rounded-sm bg-dialog-surface"
        ></span>

        <!-- Template Cards Grid -->
        <div
          :key="templateListKey"
          class="-mx-2 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-stretch gap-2"
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
                  <div class="size-full animate-pulse bg-dialog-surface"></div>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom>
                <div class="px-4 py-3">
                  <div
                    class="mb-2 h-6 animate-pulse rounded-sm bg-dialog-surface"
                  ></div>
                  <div
                    class="h-4 animate-pulse rounded-sm bg-dialog-surface"
                  ></div>
                </div>
              </CardBottom>
            </template>
          </CardContainer>

          <!-- Actual Template Cards -->
          <CardContainer
            v-for="{ template, tags } in isLoading ? [] : displayTemplates"
            :key="template.name"
            ref="cardRefs"
            size="auto"
            variant="ghost"
            rounded="lg"
            :data-testid="`template-workflow-${template.name}`"
            class="group/card h-full transition-colors hover:bg-secondary-background/50"
            @mouseenter="hoveredTemplate = template.name"
            @mouseleave="hoveredTemplate = null"
            @click="onLoadWorkflow(template)"
          >
            <template #top>
              <CardTop ratio="square">
                <template #default>
                  <!-- Template Thumbnail -->
                  <TemplatePreview
                    :template="template"
                    :base-image-src="getBaseThumbnailSrc(template)"
                    :overlay-image-src="getOverlayThumbnailSrc(template)"
                    :alt="
                      getTemplateTitle(
                        template,
                        getEffectiveSourceModule(template)
                      )
                    "
                    :get-logo-url="workflowTemplatesStore.getLogoUrl"
                    :is-hovered="hoveredTemplate === template.name"
                  >
                    <template #overlay>
                      <ProgressSpinner
                        v-if="loadingTemplate === template.name"
                        class="absolute inset-0 z-10 m-auto size-12"
                      />
                    </template>
                  </TemplatePreview>
                </template>
                <template #top-left>
                  <div
                    class="flex h-6 items-center gap-1 rounded-md bg-zinc-700/50 px-2 backdrop-blur-[20px]"
                  >
                    <i
                      :class="
                        isAppTemplate(template)
                          ? 'icon-[lucide--app-window]'
                          : 'icon-[comfy--workflow]'
                      "
                      class="size-3 text-white"
                    />
                    <span
                      class="text-xs font-medium whitespace-nowrap text-white"
                    >
                      {{
                        isAppTemplate(template)
                          ? $t('builderToolbar.app')
                          : $t('builderToolbar.nodeGraph')
                      }}
                    </span>
                  </div>
                </template>
                <template
                  v-if="template.isPartnerNode || template.tutorialUrl"
                  #top-right
                >
                  <Button
                    v-if="template.tutorialUrl"
                    v-tooltip.bottom="$t('g.seeTutorial')"
                    :aria-label="$t('g.seeTutorial')"
                    variant="inverted"
                    size="icon"
                    class="not-group-hover/card:opacity-0"
                    @click.stop="openTutorial(template)"
                  >
                    <i class="icon-[lucide--info] size-4" />
                  </Button>
                  <PaidTemplateBadge v-if="template.isPartnerNode" />
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom :full-height="false">
                <div class="flex flex-col gap-2 pt-2">
                  <h3
                    class="m-0 line-clamp-1 text-sm font-semibold"
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
                  <div
                    v-if="tags.visible.length"
                    class="flex items-center gap-2 py-1"
                  >
                    <Tag
                      v-for="tag in tags.visible"
                      :key="tag"
                      :label="tag"
                      shape="square"
                      class="bg-charcoal-500/50 opacity-80"
                    />
                    <AccessibleTooltip
                      v-if="tags.hidden.length"
                      :label="tags.hidden"
                      trigger-class="rounded-sm"
                    >
                      <Tag
                        :label="`+${tags.hidden.length}`"
                        shape="square"
                        class="bg-charcoal-500/50 opacity-80"
                      />
                    </AccessibleTooltip>
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
                  <div class="size-full animate-pulse bg-dialog-surface"></div>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom>
                <div class="px-4 py-3">
                  <div
                    class="mb-2 h-6 animate-pulse rounded-sm bg-dialog-surface"
                  ></div>
                  <div
                    class="h-4 animate-pulse rounded-sm bg-dialog-surface"
                  ></div>
                </div>
              </CardBottom>
            </template>
          </CardContainer>
        </div>
      </div>

      <!-- Load More Trigger -->
      <div
        v-if="!activeDetail && !isLoading && hasMoreTemplates"
        ref="loadTrigger"
        class="mt-4 flex h-4 w-full items-center justify-center px-6"
      >
        <div v-if="isLoadingMore" class="text-sm text-muted">
          {{ $t('templateWorkflows.loadingMore', 'Loading more...') }}
        </div>
      </div>

      <!-- Results Summary -->
      <div
        v-if="!activeDetail && !isLoading"
        class="mt-6 px-6 pb-10 text-sm text-muted"
      >
        {{
          $t('templateWorkflows.resultsCount', {
            count: filteredCount,
            total: totalCount
          })
        }}
      </div>

      <WorkflowTemplateDetail
        v-if="activeDetail"
        :title="activeDetailTitle"
        :description="getTemplateDescription(activeDetail.template)"
        :groups="activeDetailGroups"
        :cloud-url="activeDetailCloudUrl"
        :is-partner-node="activeDetail.template.openSource === false"
        :open-pending="openPending"
        :model-setup-enabled="Boolean(activeDetail.modelSetup)"
        :setup-pending="activeDetail.modelSetup?.pending"
        :requirements-met="activeDetailModelRequirementsMet"
        :starter-pack-available="activeDetailStarterPackAvailable"
        :remaining-download="activeDetailRemainingDownload"
        @open-template="onOpenTemplate"
        @download-starter-pack="onDownloadStarterPack"
        @download-model="onDownloadModel"
      >
        <template #preview>
          <TemplatePreview
            :template="activeDetail.template"
            :base-image-src="getBaseThumbnailSrc(activeDetail.template)"
            :overlay-image-src="getOverlayThumbnailSrc(activeDetail.template)"
            :alt="activeDetailTitle"
            :get-logo-url="workflowTemplatesStore.getLogoUrl"
          />
        </template>
      </WorkflowTemplateDetail>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import Tag from '@/components/chip/Tag.vue'
import PaidTemplateBadge from '@/components/custom/widget/PaidTemplateBadge.vue'
import TemplateFilterControls from '@/components/custom/widget/TemplateFilterControls.vue'
import WorkflowTemplateDetail from '@/components/custom/widget/WorkflowTemplateDetail.vue'
import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'
import TemplatePreview from '@/components/templates/thumbnails/TemplatePreview.vue'
import Button from '@/components/ui/button/Button.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import { selectCountBadgeClass } from '@/components/ui/select/select.variants'
import type { SelectOption } from '@/components/ui/select/types'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { useLazyPagination } from '@/composables/useLazyPagination'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import type { TemplateSortMode } from '@/composables/useTemplateFiltering'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import { isModelDownloadable } from '@/platform/missingModel/missingModelDownload'
import { useTelemetry } from '@/platform/telemetry'
import { useTemplateModelAvailability } from '@/platform/workflow/templates/composables/useTemplateModelAvailability'
import { useTemplateModelRowDownloads } from '@/platform/workflow/templates/composables/useTemplateModelRowDownloads'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { PreparedWorkflowTemplate } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type {
  TemplateInfo,
  TemplateTypeFilter
} from '@/platform/workflow/templates/types/template'
import { TemplateIncludeOnDistributionEnum } from '@/platform/workflow/templates/types/template'
import type {
  TemplateDetailGroup,
  TemplateDetailRow
} from '@/platform/workflow/templates/types/templateDetail'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import {
  filterTemplatesByType,
  getTemplateTags,
  isAppTemplate
} from '@/platform/workflow/templates/utils/templateDisplay'
import { extractTemplateModelRequirementDetails } from '@/platform/workflow/templates/utils/templateModelRequirements'
import type { TemplateModelRequirementDetail } from '@/platform/workflow/templates/utils/templateModelRequirements'
import type { ResolvedTemplateModelAvailability } from '@/platform/workflow/templates/utils/templateModelAvailability'
import { getTemplateModelDownloadIdentity } from '@/platform/workflow/templates/utils/templateModelDownloadState'
import { resolveTemplateModelMetadata } from '@/platform/workflow/templates/utils/templateModelMetadata'
import { deriveTemplateModelSetup } from '@/platform/workflow/templates/utils/templateModelSetup'
import type {
  TemplateModelSetupResult,
  TemplateModelSetupRow
} from '@/platform/workflow/templates/utils/templateModelSetup'
import { api } from '@/scripts/api'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'
import { formatSize } from '@/utils/formatUtil'
import { cn } from '@comfyorg/tailwind-utils'

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

// Wrap onClose to track session end
const onClose = () => {
  const timeSpentSeconds = Math.floor(
    (Date.now() - sessionStartTime.value) / 1000
  )

  useTelemetry()?.trackTemplateLibraryClosed({
    template_selected: templateWasSelected.value,
    time_spent_seconds: timeSpentSeconds
  })

  originalOnClose()
}

provide(OnCloseKey, onClose)

// Workflow templates store and composable
const workflowTemplatesStore = useWorkflowTemplatesStore()
const {
  loadTemplates,
  getTemplateThumbnailUrl,
  getTemplateTitle,
  getTemplateDescription,
  prepareWorkflowTemplate,
  openPreparedWorkflowTemplate
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

const selectedType = ref<TemplateTypeFilter>('all')

const typeTabs = computed<
  { value: TemplateTypeFilter; label: string; icon?: string }[]
>(() => [
  { value: 'all', label: t('g.all') },
  {
    value: 'nodeGraph',
    label: t('builderToolbar.nodeGraph'),
    icon: 'icon-[comfy--workflow]'
  },
  {
    value: 'apps',
    label: t('builderToolbar.app'),
    icon: 'icon-[lucide--app-window]'
  }
])

const typeFilteredTemplates = computed(() =>
  filterTemplatesByType(navigationFilteredTemplates.value, selectedType.value)
)

// Template filtering with scope awareness
const {
  searchQuery,
  selectedModels,
  selectedUseCases,
  selectedRunsOn,
  sortSelection,
  hasActiveQuery,
  activeModels,
  activeUseCases,
  filteredTemplates,
  availableModels,
  availableUseCases,
  availableRunsOn,
  filteredCount,
  totalCount,
  resetFilters
} = useTemplateFiltering(typeFilteredTemplates)

/**
 * Raw search input bound to the search box. The actual `searchQuery` consumed
 * by the filtering composable is only updated via `applySearchQuery` after the
 * debounce settles, keeping search/grid re-renders off the keystroke critical path.
 */
const searchInput = ref(searchQuery.value)

const applySearchQuery = async (query: string) => {
  searchQuery.value = query
}

/**
 * Sync the visible search input when `searchQuery` is reset externally
 * (e.g. via the "Clear all filters" action).
 */
watch(searchQuery, (value) => {
  if (value !== searchInput.value) searchInput.value = value
})

/**
 * Coordinates state between the selected navigation item and the sort order to
 * create deterministic, predictable behavior.
 * @param source The origin of the change ('nav' or 'sort').
 */
const coordinateNavAndSort = (source: 'nav' | 'sort') => {
  if (hasActiveQuery.value) return

  const isPopularNav = selectedNavItem.value === 'popular'
  const isPopularSort = sortSelection.value === 'popular'

  if (source === 'nav') {
    if (isPopularNav && !isPopularSort) {
      sortSelection.value = 'popular'
    } else if (!isPopularNav && isPopularSort) {
      sortSelection.value = 'default'
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
watch(selectedNavItem, () => coordinateNavAndSort('nav'), {
  immediate: selectedNavItem.value === 'popular'
})
watch(sortSelection, () => coordinateNavAndSort('sort'))

// Convert between string array and object array for MultiSelect component
// Only show selected items that exist in the current scope
const toSelectOptions = (values: string[]): SelectOption[] =>
  values.map((value) => ({ name: value, value }))

// active* hides out-of-scope model/use-case selections; availableRunsOn is
// static so runs-on selections are always in scope and need no filtering.
const selectedModelObjects = computed({
  get: () => toSelectOptions(activeModels.value),
  set: (value: SelectOption[]) => {
    selectedModels.value = value.map((item) => item.value)
  }
})

const selectedUseCaseObjects = computed({
  get: () => toSelectOptions(activeUseCases.value),
  set: (value: SelectOption[]) => {
    selectedUseCases.value = value.map((item) => item.value)
  }
})

const selectedRunsOnObjects = computed({
  get: () => toSelectOptions(selectedRunsOn.value),
  set: (value: SelectOption[]) => {
    selectedRunsOn.value = value.map((item) => item.value)
  }
})

const activeFilterCount = computed(
  () =>
    selectedModelObjects.value.length +
    selectedUseCaseObjects.value.length +
    selectedRunsOnObjects.value.length
)

// Any filter chip or search query is set. Keyed off intent rather than the
// result-count delta so the clear row still shows when a filter happens to
// match every template (filteredCount === totalCount).
const hasActiveFilters = computed(
  () => activeFilterCount.value > 0 || hasActiveQuery.value
)

// UI state
const mobileFiltersOpen = ref(false)
const loadingTemplate = ref<string | null>(null)
const hoveredTemplate = ref<string | null>(null)
const cardRefs = ref<HTMLElement[]>([])
type TemplateModelRowDownloads = ReturnType<typeof useTemplateModelRowDownloads>
type ActiveTemplateModelSetup = {
  result: TemplateModelSetupResult
  pending: boolean
  rowDownloads: TemplateModelRowDownloads
}

const activeDetail = ref<{
  template: TemplateInfo
  prepared: PreparedWorkflowTemplate
  groups: readonly TemplateDetailGroup[]
  modelSetup?: ActiveTemplateModelSetup
} | null>(null)
const openPending = ref(false)
let detailGeneration = 0
let modelMetadataController: AbortController | undefined

const { resolveAvailability: resolveModelAvailability } =
  useTemplateModelAvailability()

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

const sortOptions = computed(() => [
  ...(hasActiveQuery.value
    ? [
        {
          name: t('templateWorkflows.sort.relevance', 'Relevance'),
          value: 'relevance'
        }
      ]
    : []),
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

const filterControlBindings = computed(() => ({
  selectedModels: selectedModelObjects.value,
  'onUpdate:selectedModels': (value: SelectOption[]) => {
    selectedModelObjects.value = value
  },
  selectedUseCases: selectedUseCaseObjects.value,
  'onUpdate:selectedUseCases': (value: SelectOption[]) => {
    selectedUseCaseObjects.value = value
  },
  selectedRunsOn: selectedRunsOnObjects.value,
  'onUpdate:selectedRunsOn': (value: SelectOption[]) => {
    selectedRunsOnObjects.value = value
  },
  sortSelection: sortSelection.value,
  'onUpdate:sortSelection': (value: TemplateSortMode) => {
    sortSelection.value = value
  },
  modelSearchText: modelSearchText.value,
  'onUpdate:modelSearchText': (value: string) => {
    modelSearchText.value = value
  },
  modelOptions: modelOptions.value,
  useCaseOptions: useCaseOptions.value,
  runsOnOptions: runsOnOptions.value,
  sortOptions: sortOptions.value,
  modelFilterLabel: modelFilterLabel.value,
  useCaseFilterLabel: useCaseFilterLabel.value,
  runsOnFilterLabel: runsOnFilterLabel.value
}))

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
const displayTemplates = computed(() =>
  (shouldUsePagination.value
    ? paginatedTemplates.value
    : filteredTemplates.value
  ).map((template) => ({ template, tags: getTemplateTags(template) }))
)

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
    selectedType,
    sortSelection,
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
function invalidateDetailWork() {
  modelMetadataController?.abort()
  modelMetadataController = undefined
  detailGeneration++
}

function disposeActiveDetailDownloads() {
  activeDetail.value?.modelSetup?.rowDownloads.dispose()
}

function formatRequirementType(directory: string): string {
  const normalized = directory.trim().replace(/[_-]+/g, ' ')
  if (!normalized) return ''
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getModelTypeLabel(row: TemplateModelSetupRow): string {
  return row.modelType.kind === 'known'
    ? t(`templateWorkflows.detail.modelTypes.${row.modelType.key}`)
    : formatRequirementType(row.modelType.raw)
}

function getModelDetailDescription(row: TemplateModelSetupRow): string {
  const parts = [getModelTypeLabel(row)]
  if (row.fileSize !== null) parts.push(formatSize(row.fileSize))
  if (row.usedBy.length > 0) {
    parts.push(
      t('templateWorkflows.detail.usedBy', { nodes: row.usedBy.join(', ') })
    )
  }
  return parts.filter(Boolean).join(' · ')
}

function toModelDetailRow(
  row: TemplateModelSetupRow,
  rowDownloads: TemplateModelRowDownloads
): TemplateDetailRow {
  const detailRow: TemplateDetailRow = {
    id: `model:${getTemplateModelDownloadIdentity(row.model)}`,
    name: row.model.name,
    description: getModelDetailDescription(row)
  }

  switch (row.status) {
    case 'installed':
      return {
        ...detailRow,
        status: {
          kind: 'installed',
          label: t('templateWorkflows.detail.installed')
        }
      }
    case 'downloadable':
      return {
        ...detailRow,
        status: {
          kind: 'downloadable',
          label: t('templateWorkflows.detail.downloadModel'),
          downloadState: rowDownloads.stateFor(row.model)
        }
      }
    case 'manual':
      return {
        ...detailRow,
        status: {
          kind: 'manual',
          label: t('templateWorkflows.detail.getItManually'),
          href: row.href
        }
      }
    case 'unavailable':
      return {
        ...detailRow,
        status: {
          kind: 'unavailable',
          label: t('templateWorkflows.detail.unavailable')
        }
      }
    case 'unknown':
      return {
        ...detailRow,
        status: {
          kind: 'unknown',
          label: t('templateWorkflows.detail.unknown')
        }
      }
    default:
      return row satisfies never
  }
}

function getModelGroupTotal(
  template: TemplateInfo,
  setup: TemplateModelSetupResult
): string | undefined {
  if (setup.rowTotal.isComplete) return formatSize(setup.rowTotal.bytes)

  const declaredSize = template.size
  return typeof declaredSize === 'number' &&
    Number.isFinite(declaredSize) &&
    declaredSize >= 0
    ? formatSize(declaredSize)
    : undefined
}

function buildTemplateDetailGroups(
  template: TemplateInfo,
  prepared: PreparedWorkflowTemplate,
  modelSetup?: TemplateModelSetupResult,
  rowDownloads?: TemplateModelRowDownloads
): readonly TemplateDetailGroup[] {
  const modelRows =
    modelSetup && rowDownloads
      ? modelSetup.rows.map((row) => toModelDetailRow(row, rowDownloads))
      : extractTemplateModelRequirementDetails(prepared.workflow).map(
          ({ model, usedBy }) => {
            const descriptionParts = [formatRequirementType(model.directory)]
            if (usedBy.length > 0) {
              descriptionParts.push(
                t('templateWorkflows.detail.usedBy', {
                  nodes: usedBy.join(', ')
                })
              )
            }

            return {
              id: `model:${getTemplateModelDownloadIdentity(model)}`,
              name: model.name,
              description: descriptionParts.filter(Boolean).join(' · ')
            }
          }
        )
  const groups: TemplateDetailGroup[] = []

  if (modelRows.length > 0) {
    const total = modelSetup
      ? getModelGroupTotal(template, modelSetup)
      : typeof template.size === 'number' &&
          Number.isFinite(template.size) &&
          template.size >= 0
        ? formatSize(template.size)
        : undefined
    groups.push({
      id: 'models',
      label: t('templateWorkflows.detail.models'),
      ...(total && { total }),
      rows: modelRows
    })
  }

  return groups
}

function isModelRowComplete(
  row: TemplateModelSetupRow,
  rowDownloads: TemplateModelRowDownloads
): boolean {
  return (
    row.status === 'installed' ||
    (row.status === 'downloadable' &&
      rowDownloads.stateFor(row.model).status === 'done')
  )
}

function isStarterPackCandidate(
  row: TemplateModelSetupRow,
  rowDownloads: TemplateModelRowDownloads
): boolean {
  if (row.status !== 'downloadable') return false

  const state = rowDownloads.stateFor(row.model)
  return state.status === 'idle' || state.status === 'failed'
}

const activeDetailGroups = computed<readonly TemplateDetailGroup[]>(() => {
  const detail = activeDetail.value
  if (!detail) return []

  const setup = detail.modelSetup
  return setup
    ? buildTemplateDetailGroups(
        detail.template,
        detail.prepared,
        setup.result,
        setup.rowDownloads
      )
    : detail.groups
})

const activeDetailModelRequirementsMet = computed(() => {
  const setup = activeDetail.value?.modelSetup
  return Boolean(
    setup &&
    setup.result.rows.every((row) =>
      isModelRowComplete(row, setup.rowDownloads)
    )
  )
})

const activeDetailStarterPackAvailable = computed(() => {
  const setup = activeDetail.value?.modelSetup
  return Boolean(
    setup &&
    !setup.pending &&
    setup.result.rows.some((row) =>
      isStarterPackCandidate(row, setup.rowDownloads)
    )
  )
})

const activeDetailRemainingDownload = computed(() => {
  const setup = activeDetail.value?.modelSetup
  if (!setup || setup.pending) return undefined

  const remainingRows = setup.result.rows.filter(
    (row) =>
      row.status === 'downloadable' &&
      setup.rowDownloads.stateFor(row.model).status !== 'done'
  )
  if (
    remainingRows.length === 0 ||
    remainingRows.some((row) => row.fileSize === null)
  ) {
    return undefined
  }

  return formatSize(
    remainingRows.reduce((total, row) => total + (row.fileSize ?? 0), 0)
  )
})

async function updateTemplateModelMetadata(
  generation: number,
  controller: AbortController,
  requirements: readonly TemplateModelRequirementDetail[],
  availability: readonly ResolvedTemplateModelAvailability[]
) {
  try {
    const metadata = await resolveTemplateModelMetadata(
      requirements.map(({ model }) => model),
      { signal: controller.signal }
    )
    if (metadata.status === 'aborted' || generation !== detailGeneration) return

    const setup = activeDetail.value?.modelSetup
    if (!setup) return

    setup.result = deriveTemplateModelSetup(
      requirements,
      availability,
      metadata,
      { isDownloadable: isModelDownloadable }
    )
    setup.pending = false
  } catch (error) {
    if (!controller.signal.aborted && generation === detailGeneration) {
      const setup = activeDetail.value?.modelSetup
      if (setup) setup.pending = false
      console.error('Error loading workflow template model metadata:', error)
    }
  } finally {
    if (modelMetadataController === controller) {
      modelMetadataController = undefined
    }
  }
}

function isTemplateAvailableOnCloud(template: TemplateInfo): boolean {
  if (!template.includeOnDistributions?.length) return true
  return template.includeOnDistributions.includes(
    TemplateIncludeOnDistributionEnum.Cloud
  )
}

async function openPreparedTemplate(
  prepared: PreparedWorkflowTemplate,
  generation: number
): Promise<void> {
  if (openPending.value) return

  openPending.value = true
  try {
    const didOpen = await openPreparedWorkflowTemplate(prepared, {
      closeDialog: false
    })
    if (didOpen && generation === detailGeneration) {
      templateWasSelected.value = true
      onClose()
    }
  } catch (error) {
    if (generation === detailGeneration) {
      console.error('Error opening workflow template:', error)
    }
  } finally {
    if (generation === detailGeneration) openPending.value = false
  }
}

const onLoadWorkflow = async (template: TemplateInfo) => {
  if (openPending.value) return

  disposeActiveDetailDownloads()
  invalidateDetailWork()
  const generation = detailGeneration
  loadingTemplate.value = template.name
  try {
    const prepared = await prepareWorkflowTemplate(
      template.name,
      getEffectiveSourceModule(template)
    )
    if (!prepared || generation !== detailGeneration) return

    const groups = buildTemplateDetailGroups(template, prepared)
    if (!isDesktop) {
      activeDetail.value = { template, prepared, groups }
      return
    }

    const modelRequirements = extractTemplateModelRequirementDetails(
      prepared.workflow
    )
    if (modelRequirements.length === 0) {
      await openPreparedTemplate(prepared, generation)
      return
    }

    const models = modelRequirements.map(({ model }) => model)
    const modelAvailability = await resolveModelAvailability(models)
    if (generation !== detailGeneration) return
    if (modelAvailability.every(({ status }) => status === 'installed')) {
      await openPreparedTemplate(prepared, generation)
      return
    }

    const rowDownloads = useTemplateModelRowDownloads({
      loadFolderPaths: () => api.getFolderPaths()
    })
    activeDetail.value = {
      template,
      prepared,
      groups,
      modelSetup: {
        result: deriveTemplateModelSetup(
          modelRequirements,
          modelAvailability,
          { status: 'aborted' },
          { isDownloadable: isModelDownloadable }
        ),
        pending: true,
        rowDownloads
      }
    }

    const controller = new AbortController()
    modelMetadataController = controller
    void updateTemplateModelMetadata(
      generation,
      controller,
      modelRequirements,
      modelAvailability
    )
  } catch (error) {
    if (generation === detailGeneration) {
      console.error('Error preparing workflow template:', error)
    }
  } finally {
    if (generation === detailGeneration) loadingTemplate.value = null
  }
}

function onBackToTemplates() {
  if (openPending.value) return

  disposeActiveDetailDownloads()
  invalidateDetailWork()
  activeDetail.value = null
  loadingTemplate.value = null
}

function onSelectNavItem(value: string | null) {
  if (openPending.value) return

  disposeActiveDetailDownloads()
  invalidateDetailWork()
  activeDetail.value = null
  loadingTemplate.value = null
  selectedNavItem.value = value
}

const onOpenTemplate = async () => {
  const detail = activeDetail.value
  if (!detail || openPending.value) return

  await openPreparedTemplate(detail.prepared, detailGeneration)
}

function onDownloadModel(rowId: string) {
  const setup = activeDetail.value?.modelSetup
  if (!setup) return

  const row = setup.result.rows.find(
    (candidate) =>
      candidate.status === 'downloadable' &&
      `model:${getTemplateModelDownloadIdentity(candidate.model)}` === rowId
  )
  if (row?.status === 'downloadable') {
    setup.rowDownloads.request(row.model)
  }
}

async function onDownloadStarterPack() {
  const setup = activeDetail.value?.modelSetup
  if (!setup || setup.pending || openPending.value) return

  for (const row of setup.result.rows) {
    if (isStarterPackCandidate(row, setup.rowDownloads)) {
      setup.rowDownloads.request(row.model)
    }
  }

  await onOpenTemplate()
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

const activeDetailTitle = computed(() => {
  const detail = activeDetail.value
  return detail
    ? getTemplateTitle(
        detail.template,
        getEffectiveSourceModule(detail.template)
      )
    : ''
})

const activeDetailCloudUrl = computed(() => {
  const detail = activeDetail.value
  if (isCloud || !detail || !isTemplateAvailableOnCloud(detail.template)) {
    return undefined
  }

  const url = new URL('https://cloud.comfy.org/')
  url.searchParams.set('template', detail.template.name)
  return url.toString()
})

// Initialize templates loading with useAsyncState
const { isLoading } = useAsyncState(
  async () => {
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
  disposeActiveDetailDownloads()
  invalidateDetailWork()
  cardRefs.value = [] // Release DOM refs
})
</script>
