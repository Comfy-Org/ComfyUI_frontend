<template>
  <BaseModalLayout
    v-model:right-panel-open="isRightPanelOpen"
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
      <SearchBox
        v-model="searchQuery"
        size="lg"
        class="max-w-[384px]"
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
        class="text-neutral px-6 pt-4 pb-2 text-2xl font-semibold flex items-center gap-2"
      >
        <template v-if="isMyTemplatesView && showSubmissionForm">
          <button
            class="cursor-pointer border-none bg-transparent p-0 text-2xl font-semibold text-muted transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
            @click="cancelPublishing"
          >
            {{ pageTitle }}
          </button>
          <StepBreadcrumbs
            :labels="stepLabels"
            :current-step="currentStep"
            @navigate="(step) => goToStep(step)"
          />
        </template>
        <template v-else>
          <span>
            {{ pageTitle }}
          </span>
          <button
            v-if="isMyTemplatesView && myTemplates.length > 0"
            class="border-none cursor-pointer flex size-7 items-center justify-center rounded-full text-blue-500 transition-colors hover:bg-blue-500/10"
            :title="t('templateWorkflows.publish.newTemplate')"
            @click="startPublishing"
          >
            <i class="icon-[lucide--plus] size-5" />
          </button>
        </template>
      </div>
    </template>

    <template #content>
      <PublishTemplateWizard
        v-if="isMyTemplatesView && showSubmissionForm"
        @cancel="cancelPublishing"
        @submitted="onPublishSubmitted"
        @draft-saved="onDraftSaved"
      />

      <MyTemplatesEmptyState
        v-else-if="isMyTemplatesView && myTemplates.length === 0 && !isLoading"
        @create="startPublishing"
      />

      <!-- No Results State (only show when loaded and no results) -->
      <div
        v-else-if="!isLoading && filteredTemplates.length === 0"
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
      <div v-else class="flex flex-col flex-grow">
        <!-- Dashboard for My Templates -->
        <MyTemplatesDashboard
          v-if="
            isMyTemplatesView && !showSubmissionForm && myTemplates.length > 0
          "
          :templates="myTemplates"
        />

        <!-- Title -->
        <span
          v-if="isLoading"
          class="inline-block h-8 w-48 animate-pulse rounded bg-dialog-surface"
        ></span>

        <!-- Template Cards Grid -->
        <div
          :key="templateListKey"
          class="grid flex-1 grid-cols-2 content-start gap-4 p-1 lg:grid-cols-3 xl:grid-cols-4"
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
            v-show="isTemplateVisibleOnDistribution(template)"
            :key="template.name"
            ref="cardRefs"
            size="compact"
            variant="ghost"
            rounded="lg"
            :data-testid="`template-workflow-${template.name}`"
            :class="
              cn(
                'hover:bg-base-background',
                selectedTemplate?.name === template.name &&
                  'bg-secondary-background outline-solid outline-4 outline-base-foreground'
              )
            "
            @mouseenter="hoveredTemplate = template.name"
            @mouseleave="hoveredTemplate = null"
            @click="
              selectedTemplate =
                selectedTemplate?.name === template.name ? null : template
            "
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
                    <LogoOverlay
                      v-if="template.logos?.length"
                      :logos="template.logos"
                      :get-logo-url="workflowTemplatesStore.getLogoUrl"
                    />
                    <ProgressSpinner
                      v-if="loadingTemplate === template.name"
                      class="absolute inset-0 z-10 m-auto h-12 w-12"
                    />
                  </div>
                </template>
                <template #bottom-right>
                  <StatusBadge
                    v-if="isMyTemplatesView && isMarketplaceTemplate(template)"
                    :label="
                      t(
                        `templateWorkflows.myTemplates.status.${template.status}`
                      )
                    "
                    :severity="STATUS_SEVERITY[template.status]"
                  />
                  <template
                    v-else-if="template.tags && template.tags.length > 0"
                  >
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
                      <div
                        class="comfy-markdown-content m-0 line-clamp-1 text-sm text-muted"
                        :title="getTemplateDescription(template)"
                        v-html="
                          renderMarkdownToHtml(getTemplateDescription(template))
                        "
                      />
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
        v-if="!isLoading && !isMyTemplatesView"
        class="mt-6 px-6 text-sm text-muted"
      >
        {{
          $t('templateWorkflows.resultsCount', {
            count: filteredCount,
            total: totalCount
          })
        }}
      </div>
    </template>

    <template #rightPanel>
      <div ref="rightPanelRef" class="flex flex-grow flex-col">
        <MarketplaceTemplateDetailsPanel
          v-if="selectedSubmission"
          :submission="selectedSubmission"
          @edit="handleEditSubmission"
          @remove="handleRemoveSubmission"
        />
        <WorkflowTemplateDetailsPanel
          v-else-if="selectedTemplate"
          :template="selectedTemplate"
          :is-installing="loadingTemplate === selectedTemplate.name"
          @install="onLoadWorkflow"
        />
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { onClickOutside, useAsyncState } from '@vueuse/core'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import SquareChip from '@/components/chip/SquareChip.vue'
import SearchBox from '@/components/common/SearchBox.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import StepBreadcrumbs from '@/components/common/StepBreadcrumbs.vue'
import MultiSelect from '@/components/input/MultiSelect.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import Button from '@/components/ui/button/Button.vue'
import WorkflowTemplateDetailsPanel from '@/components/custom/widget/WorkflowTemplateDetailsPanel.vue'
import MarketplaceTemplateDetailsPanel from '@/platform/marketplace/components/MarketplaceTemplateDetailsPanel.vue'
import MyTemplatesDashboard from '@/platform/marketplace/components/MyTemplatesDashboard.vue'
import MyTemplatesEmptyState from '@/platform/marketplace/components/MyTemplatesEmptyState.vue'
import { useMyTemplates } from '@/platform/marketplace/composables/useMyTemplates'
import {
  approveTemplate,
  deleteTemplate
} from '@/platform/marketplace/services/templateApi'
import type { MarketplaceTemplate } from '@/platform/marketplace/types/marketplace'
import {
  isMarketplaceTemplate,
  STATUS_SEVERITY
} from '@/platform/marketplace/types/marketplace'
import PublishTemplateWizard from '@/platform/marketplace/components/PublishTemplateWizard.vue'
import { usePublishTemplateWizard } from '@/platform/marketplace/composables/usePublishTemplateWizard'
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

import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()

const {
  onClose: originalOnClose,
  initialCategory = 'all',
  publishWorkflow
} = defineProps<{
  onClose: () => void
  initialCategory?: string
  publishWorkflow?: string
}>()

// Track session time for telemetry
const sessionStartTime = ref<number>(0)
const templateWasSelected = ref(false)
const selectedTemplate = ref<TemplateInfo | null>(null)

const selectedSubmission = computed(() => {
  if (!isMyTemplatesView.value || !selectedTemplate.value) return null

  return myTemplates.value.find(({ id }) => id === selectedTemplate.value?.name)
})

const isRightPanelOpen = computed({
  get() {
    return !!selectedTemplate.value
  },
  set(value: boolean) {
    if (!value) {
      selectedTemplate.value = null
    }
  }
})

onMounted(() => {
  sessionStartTime.value = Date.now()
  if (publishWorkflow) {
    startPublishingWithWorkflow(publishWorkflow)
  }
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

const { templates: myTemplates, refresh: refreshMyTemplates } = useMyTemplates()

// DEV ONLY: Expose back-door for testing marketplace templates
// Usage: window.__marketplace.approve('template-id')
// Usage: window.__marketplace.list() to see all templates and IDs
Object.assign(window, {
  __marketplace: {
    async approve(id: string) {
      const result = await approveTemplate(id)
      if (result) await refreshMyTemplates()
      return result
    },
    list: () =>
      myTemplates.value.map(({ id, name, status }) => ({ id, name, status }))
  }
})

const showSubmissionForm = ref(false)
const { resetWizard, wizardData, currentStep, goToStep } =
  usePublishTemplateWizard()

function startPublishing() {
  resetWizard()
  selectedTemplate.value = null
  showSubmissionForm.value = true
}

function startPublishingWithWorkflow(workflowFilename: string) {
  resetWizard()
  wizardData.value.name = workflowFilename
  showSubmissionForm.value = true
}

function cancelPublishing() {
  showSubmissionForm.value = false
}

function onPublishSubmitted() {
  showSubmissionForm.value = false
  void refreshMyTemplates()
}

function onDraftSaved() {
  showSubmissionForm.value = false
  void refreshMyTemplates()
}

function handleEditSubmission() {
  if (!selectedSubmission.value) return
  wizardData.value = { ...selectedSubmission.value }
  selectedTemplate.value = null
  showSubmissionForm.value = true
}

async function handleRemoveSubmission(id: string) {
  await deleteTemplate(id)
  selectedTemplate.value = null
  void refreshMyTemplates()
}

const stepLabels = [
  t('templateWorkflows.publish.stepMetadata'),
  t('templateWorkflows.publish.stepMedia'),
  t('templateWorkflows.publish.stepReview')
]

const isMyTemplatesView = computed(
  () => selectedNavItem.value === 'my-templates'
)

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
  if (isMarketplaceTemplate(template)) {
    const gallery = template.gallery
    if (gallery?.length) return gallery[0]
  }
  const sm = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(template, sm, sm === 'default' ? '1' : '')
}

const getOverlayThumbnailSrc = (template: TemplateInfo) => {
  if (isMarketplaceTemplate(template)) {
    const gallery = template.gallery
    if (gallery && gallery.length >= 2) return gallery[1]
  }
  const sm = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(template, sm, sm === 'default' ? '2' : '')
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
  const storeItems = workflowTemplatesStore.navGroupedTemplates
  const myTemplatesItem: NavItemData = {
    id: 'my-templates',
    label: t('templateWorkflows.myTemplates.title'),
    icon: 'icon-[lucide--user]'
  }
  const [all, ...rest] = storeItems
  return all ? [all, myTemplatesItem, ...rest] : [myTemplatesItem]
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
watch(selectedNavItem, () => {
  coordinateNavAndSort('nav')
  selectedTemplate.value = null
})
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
const cardRefs = ref<HTMLElement[]>([])

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

function toTemplateInfo(submission: MarketplaceTemplate): TemplateInfo {
  return {
    ...submission,
    name: submission.id,
    title: submission.name,
    description: submission.shortDescription ?? '',
    mediaType: submission.mediaType ?? 'image',
    sourceModule: 'marketplace',
    mediaSubtype: 'webp'
  }
}

const approvedMarketplaceTemplates = computed(() =>
  myTemplates.value
    .filter(({ status }) => status === 'approved')
    .map(toTemplateInfo)
)

// Display templates (all when searching, paginated when not)
const displayTemplates = computed(() => {
  if (isMyTemplatesView.value) {
    return myTemplates.value.map(toTemplateInfo)
  }
  const base = shouldUsePagination.value
    ? paginatedTemplates.value
    : filteredTemplates.value
  return [...approvedMarketplaceTemplates.value, ...base]
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

const rightPanelRef = ref<HTMLElement | null>(null)

onClickOutside(rightPanelRef, () => {
  selectedTemplate.value = null
})

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

const isTemplateVisibleOnDistribution = (template: TemplateInfo) => {
  return (template.includeOnDistributions?.length ?? 0) > 0
    ? distributions.value.some((d) =>
        template.includeOnDistributions?.includes(d)
      )
    : true
}

onBeforeUnmount(() => {
  cardRefs.value = [] // Release DOM refs
})
</script>
