<template>
  <div
    ref="panelRootRef"
    class="@container/templates-panel flex size-full flex-col overflow-hidden"
    data-testid="templates-sidebar-tab"
  >
    <!-- Header: title + search + filters toggle + type pills -->
    <div class="flex shrink-0 flex-col gap-3 px-4 pt-4 pb-3">
      <h2 class="text-neutral m-0 text-base font-semibold">
        {{ $t('sideToolbar.templates', 'Templates') }}
      </h2>

      <div class="flex items-center gap-2">
        <AsyncSearchInput
          v-model="searchInput"
          :searcher="applySearchQuery"
          :debounce-ms="400"
          :debounce-max-wait-ms="4000"
          class="h-9 w-full min-w-0 flex-1 border border-border-subtle bg-transparent"
          autofocus
        />
        <!-- Filter menu: same primitives and behaviours as the Media Assets
             filter (#14166) — nested submenus, menu stays open while picking,
             a dot on the trigger when anything is applied. -->
        <DropdownMenu :modal="false">
          <template #button>
            <Button
              variant="secondary"
              size="icon"
              :aria-label="$t('templateWorkflows.filtersButton')"
              data-testid="templates-filters-toggle"
              class="relative size-9 shrink-0"
            >
              <i class="icon-[lucide--list-filter] size-4" />
              <span
                v-if="activeFilterCount > 0"
                aria-hidden="true"
                class="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-base-foreground"
              />
            </Button>
          </template>
          <TemplatesFilterMenu
            :facets="filterMenuFacets"
            @toggle="toggleFilterValue"
            @clear-facet="clearFilterFacet"
            @clear-all="clearAllFilters"
          />
        </DropdownMenu>

        <!-- Sort popover: mirrors the Assets sidebar settings menu -->
        <Popover :show-arrow="false">
          <template #button>
            <Button
              variant="secondary"
              size="icon"
              :aria-label="$t('templateWorkflows.sorting')"
              class="size-9 shrink-0"
            >
              <i class="icon-[lucide--arrow-up-down] size-4" />
            </Button>
          </template>
          <template #default="{ close }">
            <div
              class="flex min-w-48 flex-col"
              data-testid="template-sort-menu"
            >
              <Button
                v-for="option in sortOptions"
                :key="option.value"
                variant="textonly"
                class="w-full"
                @click="selectSort(option.value, close)"
              >
                <span>{{ option.name }}</span>
                <i
                  class="ml-auto icon-[lucide--check] size-4"
                  :class="sortSelection !== option.value && 'opacity-0'"
                />
              </Button>
            </div>
          </template>
        </Popover>
      </div>

      <!-- Type and generation type share one line: they are two halves of the
           same question. The generation-type half collapses into a dropdown
           when the panel is too narrow for both. -->
      <div class="flex items-center gap-2">
        <div
          class="flex shrink-0 items-center gap-2"
          data-testid="template-type-tabs"
        >
          <Button
            v-for="tab in typeTabs"
            :key="tab.value"
            size="md"
            :variant="selectedType === tab.value ? 'inverted' : 'secondary'"
            :aria-pressed="selectedType === tab.value"
            class="h-7 shrink-0 rounded-md px-2.5 text-xs"
            @click="selectedType = tab.value"
          >
            <i v-if="tab.icon" :class="cn(tab.icon, 'size-3')" />
            <span>{{ tab.label }}</span>
          </Button>
        </div>

        <template v-if="generationTypeOptions.length">
          <div class="h-5 w-px shrink-0 bg-border-subtle" />

          <div
            class="hidden min-w-0 flex-1 @2xl/templates-panel:block"
            data-testid="template-generation-types"
          >
            <TemplatesFilterChipRow>
              <button
                v-for="opt in generationTypeOptions"
                :key="opt.value"
                type="button"
                :aria-pressed="selectedCategory === opt.value"
                :class="
                  cn(
                    'shrink-0',
                    filterChipClass(selectedCategory === opt.value)
                  )
                "
                @click="toggleGenerationType(opt.value)"
              >
                {{ opt.name }}
              </button>
            </TemplatesFilterChipRow>
          </div>

          <!-- Wrapper, not a class on DropdownMenu: that component sets
               inheritAttrs false and forwards $attrs to the popup content, so
               the class would hide the menu instead of its trigger. -->
          <div
            class="shrink-0 @2xl/templates-panel:hidden"
            data-testid="template-generation-type-menu"
          >
            <DropdownMenu :modal="false">
              <template #button>
                <Button
                  variant="secondary"
                  size="md"
                  class="h-7 shrink-0 rounded-md px-2.5 text-xs"
                >
                  <span class="max-w-28 truncate">
                    {{ selectedGenerationType?.name ?? generationTypeLabel }}
                  </span>
                  <i class="icon-[lucide--chevron-down] size-3.5" />
                </Button>
              </template>
              <DropdownMenuRadioGroup :model-value="selectedCategory">
                <DropdownMenuRadioItem
                  v-for="opt in generationTypeOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm outline-none data-highlighted:bg-secondary-background-hover"
                  @click="toggleGenerationType(opt.value)"
                  @select.prevent
                >
                  <span class="flex-1">{{ opt.name }}</span>
                  <DropdownMenuItemIndicator class="size-4 shrink-0">
                    <i class="icon-[lucide--check]" />
                  </DropdownMenuItemIndicator>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenu>
          </div>
        </template>
      </div>

      <!-- Applied filters as removable chips + Clear all, same shape as the
           Media Assets filter bar (#14166). -->
      <div
        v-if="appliedFilters.length"
        class="flex flex-wrap items-center gap-1.5"
        data-testid="template-applied-filters"
      >
        <span
          v-for="pill in appliedFilters"
          :key="`${pill.facetKey}:${pill.value}`"
          class="inline-flex items-center gap-1 rounded-md bg-secondary-background py-1 pr-1 pl-2 text-xs whitespace-nowrap"
        >
          <span class="max-w-32 truncate">{{ pill.label }}</span>
          <Button
            variant="textonly"
            size="icon"
            class="size-4 rounded-sm p-0"
            :aria-label="`${$t('g.remove')}: ${pill.label}`"
            @click="toggleFilterValue(pill.facetKey, pill.value)"
          >
            <i class="icon-[lucide--x] size-3" />
          </Button>
        </span>
        <Button
          variant="textonly"
          class="h-6 px-1.5 text-xs text-muted-foreground"
          @click="clearAllFilters"
        >
          {{ $t('templateWorkflows.clearAllFilters') }}
        </Button>
      </div>
    </div>

    <!-- Scrollable template grid -->
    <div
      class="scrollbar-custom h-0 grow overflow-y-auto px-4 pb-4"
      @scroll.passive="hideHoverPreview"
    >
      <!-- No Results State -->
      <div
        v-if="!isLoading && filteredTemplates.length === 0"
        class="flex h-64 flex-col items-center justify-center text-neutral-500"
      >
        <i class="mb-4 icon-[lucide--search] size-10 opacity-50" />
        <p class="mb-1 text-base">
          {{ $t('templateWorkflows.noResults', 'No templates found') }}
        </p>
        <p class="text-center text-sm">
          {{
            $t(
              'templateWorkflows.noResultsHint',
              'Try adjusting your search or filters'
            )
          }}
        </p>
      </div>
      <div v-else>
        <div
          :key="templateListKey"
          class="grid grid-cols-[repeat(auto-fill,minmax(min(200px,30vw),1fr))] items-stretch gap-2"
          data-testid="template-workflows-content"
        >
          <!-- Loading Skeletons -->
          <CardContainer
            v-for="n in isLoading ? 8 : 0"
            :key="`initial-skeleton-${n}`"
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
                <div class="p-2">
                  <div
                    class="mb-2 h-5 animate-pulse rounded-sm bg-dialog-surface"
                  ></div>
                  <div
                    class="h-3 animate-pulse rounded-sm bg-dialog-surface"
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
            size="auto"
            variant="ghost"
            rounded="lg"
            :data-testid="`template-workflow-${template.name}`"
            class="group/card h-full transition-colors hover:bg-secondary-background/50"
            @mouseenter="onCardEnter(template, $event)"
            @mouseleave="onCardLeave()"
            @click="onLoadWorkflow(template)"
          >
            <template #top>
              <CardTop ratio="square">
                <template #default>
                  <!-- Template Thumbnail -->
                  <div class="relative size-full overflow-hidden rounded-lg">
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
                        :hover-zoom="0"
                      />
                    </template>
                    <LogoOverlay
                      v-if="template.logos?.length"
                      :logos="template.logos"
                      :get-logo-url="workflowTemplatesStore.getLogoUrl"
                      default-position="right-2 bottom-2"
                    />
                    <ProgressSpinner
                      v-if="loadingTemplate === template.name"
                      class="absolute inset-0 z-10 m-auto size-10"
                    />
                  </div>
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
                  <!-- Production parity: templates can link a tutorial from
                       the card; shown on hover only, styled like the blur
                       badges. click.stop keeps it from loading the workflow. -->
                  <button
                    v-if="template.tutorialUrl"
                    v-tooltip.bottom="$t('g.seeTutorial')"
                    type="button"
                    :aria-label="$t('g.seeTutorial')"
                    class="flex size-7 cursor-pointer items-center justify-center rounded-lg border-none bg-black/30 p-0 text-white backdrop-blur-[20px] transition-opacity not-group-hover/card:opacity-0"
                    @click.stop="openTutorial(template)"
                  >
                    <i class="icon-[lucide--graduation-cap] size-4" />
                  </button>
                  <PaidTemplateBadge v-if="template.isPartnerNode" />
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom :full-height="false">
                <!-- Tags are search/filter data, not card chrome; readiness
                     lives in the detail view (PM-243). -->
                <h3
                  class="m-0 line-clamp-1 pt-2 text-xs font-medium"
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
              </CardBottom>
            </template>
          </CardContainer>

          <!-- Loading More Skeletons -->
          <CardContainer
            v-for="n in isLoadingMore ? 4 : 0"
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
                <div class="p-2">
                  <div
                    class="mb-2 h-5 animate-pulse rounded-sm bg-dialog-surface"
                  ></div>
                  <div
                    class="h-3 animate-pulse rounded-sm bg-dialog-surface"
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
      <div v-if="!isLoading" class="mt-4 text-sm text-muted">
        {{
          $t('templateWorkflows.resultsCount', {
            count: filteredCount,
            total: totalCount
          })
        }}
      </div>
    </div>
    <!-- Hover quick-info flyout, floating right of the panel like the node
         search preview (Pablo, 08-03): what this template needs to run. -->
    <Teleport to="body">
      <div
        v-if="hoverPreview && hoverReadiness"
        class="pointer-events-none fixed z-1400 flex w-[340px] animate-in flex-col gap-3 rounded-xl border border-border-subtle bg-base-background p-4 shadow-xl duration-150 fade-in-0 slide-in-from-left-1"
        :style="{
          left: `${hoverPreview.left}px`,
          top: `${hoverPreview.top}px`
        }"
        data-testid="template-hover-preview"
      >
        <!-- No type badge here: the card being hovered already carries it, and
             the flyout's job is what the card can't say. -->
        <div class="flex flex-wrap items-center gap-2">
          <span
            :class="
              cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
                READINESS_STYLES[hoverReadiness.state].pill
              )
            "
          >
            <span
              :class="
                cn(
                  'size-1.5 rounded-full',
                  READINESS_STYLES[hoverReadiness.state].dot
                )
              "
            />
            {{ $t(`templateWorkflows.readiness.${hoverReadiness.state}`) }}
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <h3 class="m-0 line-clamp-2 text-sm/snug font-semibold">
            {{
              getTemplateTitle(
                hoverPreview.template,
                getEffectiveSourceModule(hoverPreview.template)
              )
            }}
          </h3>
          <p
            v-if="getTemplateDescription(hoverPreview.template)"
            class="m-0 line-clamp-3 text-xs/relaxed text-muted-foreground"
          >
            {{ getTemplateDescription(hoverPreview.template) }}
          </p>
        </div>

        <!-- Laid out like the design system's Model/Node/Asset info panels:
             an uppercase section label, then label-left / value-right rows so
             the values form a readable column, with list-valued fields
             dropping to pills underneath instead of squeezing into the row. -->
        <div
          v-if="hoverMetaFields.length"
          class="-mx-4 flex flex-col gap-2 border-t border-border-subtle px-4 pt-3"
        >
          <span
            class="text-2xs font-semibold tracking-wider text-muted-foreground uppercase"
          >
            {{ $t('templateWorkflows.detail.requirements') }}
          </span>
          <dl class="m-0 flex flex-col gap-2">
            <template v-for="field in hoverMetaFields" :key="field.label">
              <div v-if="field.chips" class="flex flex-col gap-1.5 text-xs">
                <dt class="text-muted-foreground">{{ field.label }}</dt>
                <dd class="m-0 flex flex-wrap gap-1">
                  <span
                    v-for="chip in field.chips"
                    :key="chip"
                    class="max-w-full truncate rounded-full bg-secondary-background px-2 py-0.5 text-xs text-base-foreground"
                  >
                    {{ chip }}
                  </span>
                </dd>
              </div>
              <div
                v-else
                class="flex items-baseline justify-between gap-3 text-xs"
              >
                <dt class="shrink-0 text-muted-foreground">
                  {{ field.label }}
                </dt>
                <dd class="m-0 min-w-0 truncate text-right tabular-nums">
                  {{ field.value }}
                </dd>
              </div>
            </template>
          </dl>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import ProgressSpinner from 'primevue/progressspinner'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import PaidTemplateBadge from '@/components/custom/widget/PaidTemplateBadge.vue'
import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import LogoOverlay from '@/components/templates/thumbnails/LogoOverlay.vue'
import TemplatesFilterChipRow from '@/components/sidebar/tabs/TemplatesFilterChipRow.vue'
import TemplatesFilterMenu from '@/components/sidebar/tabs/TemplatesFilterMenu.vue'
import type { FilterMenuFacet } from '@/components/sidebar/tabs/TemplatesFilterMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/common/DropdownMenu.vue'
import {
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from 'reka-ui'
import Popover from '@/components/ui/Popover.vue'
import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'
import type { SelectOption } from '@/components/ui/select/types'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { useLazyPagination } from '@/composables/useLazyPagination'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import type { TemplateSortMode } from '@/composables/useTemplateFiltering'
import { useTelemetry } from '@/platform/telemetry'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type {
  TemplateInfo,
  TemplateTypeFilter
} from '@/platform/workflow/templates/types/template'
import {
  filterTemplatesByType,
  isAppTemplate
} from '@/platform/workflow/templates/utils/templateDisplay'
import { getTemplateReadiness } from '@/platform/workflow/templates/utils/templateReadiness'
import type { TemplateReadinessState } from '@/platform/workflow/templates/utils/templateReadiness'
import { formatSize } from '@/utils/formatUtil'
import { useNewUserService } from '@/services/useNewUserService'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useTemplatesPanelStore } from '@/stores/workspace/templatesPanelStore'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()

const GETTING_STARTED_CATEGORY_ID = 'basics-getting-started'

const templatesPanelStore = useTemplatesPanelStore()
const sidebarTabStore = useSidebarTabStore()
const newUserService = useNewUserService()

// Session telemetry: the panel lifetime is the browsing session (mount ->
// unmount), mirroring the open/close events the modal used to emit.
const sessionStartTime = ref<number>(0)
const templateWasSelected = ref(false)

onMounted(() => {
  sessionStartTime.value = Date.now()
  useTelemetry()?.trackTemplateLibraryOpened({
    source: templatesPanelStore.consumeOpenSource()
  })
})

onUnmounted(() => {
  const timeSpentSeconds = Math.floor(
    (Date.now() - sessionStartTime.value) / 1000
  )
  useTelemetry()?.trackTemplateLibraryClosed({
    template_selected: templateWasSelected.value,
    time_spent_seconds: timeSpentSeconds
  })
  templatesPanelStore.runAfterClose()
})

const closePanel = () => {
  if (sidebarTabStore.activeSidebarTabId === 'templates') {
    sidebarTabStore.toggleSidebarTab('templates')
  }
}

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

// Category options: the modal's left-nav tree flattened for the narrow panel.
const categoryOptions = computed<SelectOption[]>(() => {
  const navItems = workflowTemplatesStore.navGroupedTemplates as (
    | NavItemData
    | NavGroupData
  )[]
  return navItems.flatMap((item) =>
    'id' in item
      ? [{ name: item.label, value: item.id }]
      : (item.items ?? []).map((sub) => ({ name: sub.label, value: sub.id }))
  )
})

/**
 * The grouped categories — Image / Video / Audio / 3D Model / LLM in the
 * current catalog. Pablo (08-05): "the one thing I know as a user is what I
 * want to generate", so these get a row in the header instead of living two
 * clicks deep in the filter sheet. Derived from the nav groups rather than a
 * hardcoded list, so a catalog change carries over.
 */
const generationTypeOptions = computed<SelectOption[]>(() => {
  const navItems = workflowTemplatesStore.navGroupedTemplates as (
    | NavItemData
    | NavGroupData
  )[]
  return navItems.flatMap((item) =>
    'id' in item
      ? []
      : (item.items ?? []).map((sub) => ({ name: sub.label, value: sub.id }))
  )
})

/** The catalog's own name for the group, for the collapsed dropdown's label. */
const generationTypeLabel = computed(() => {
  const navItems = workflowTemplatesStore.navGroupedTemplates as (
    | NavItemData
    | NavGroupData
  )[]
  const group = navItems.find((item) => !('id' in item)) as
    | NavGroupData
    | undefined
  return group?.title ?? t('templateWorkflows.category', 'Category')
})

const selectedGenerationType = computed(() =>
  generationTypeOptions.value.find(
    (option) => option.value === selectedCategory.value
  )
)

/** Clicking the active one clears it, so the row doubles as its own reset. */
const toggleGenerationType = (value: string) => {
  selectedCategory.value = selectedCategory.value === value ? 'all' : value
}

// Get enhanced templates for better filtering
const allTemplates = computed(() => workflowTemplatesStore.enhancedTemplates)

// Navigation (category deep-links from entry points still work via the store)
const selectedNavItem = ref<string | null>(
  templatesPanelStore.consumeRequestedCategory() ??
    (newUserService.isNewUser() ? GETTING_STARTED_CATEGORY_ID : 'all')
)

// SingleSelect needs a non-null string model; bridge it to selectedNavItem.
const selectedCategory = computed({
  get: () => selectedNavItem.value ?? 'all',
  set: (value: string) => {
    selectedNavItem.value = value
  }
})

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

watch(selectedNavItem, () => coordinateNavAndSort('nav'))
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

const addedFilterCount = computed(
  () =>
    selectedModelObjects.value.length +
    selectedUseCaseObjects.value.length +
    selectedRunsOnObjects.value.length
)

/**
 * The category counts towards the trigger badge (Pablo, 08-05): picking one
 * and closing the sheet left the button looking untouched, so the view was
 * filtered with nothing on screen saying so.
 */
const activeFilterCount = computed(
  () => addedFilterCount.value + (selectedCategory.value === 'all' ? 0 : 1)
)

const clearAllFilters = () => {
  resetFilters()
  selectedNavItem.value = 'all'
}

// ---- Linear-style filter menu ----

type FilterFacetKey = 'category' | 'model' | 'task' | 'runsOn'

/**
 * One descriptor per facet, consumed by both the drill-down menu and the
 * applied-filter pills so the two can never disagree about what is on.
 */
const filterMenuFacets = computed<FilterMenuFacet[]>(() => [
  {
    key: 'category',
    label: t('templateWorkflows.category', 'Category'),
    options: categoryOptions.value,
    selectedValues: [selectedCategory.value],
    mode: 'single',
    emptyValue: 'all'
  },
  {
    key: 'model',
    label: t('templateWorkflows.modelFilter', 'Model'),
    options: modelOptions.value,
    selectedValues: activeModels.value,
    mode: 'multiple'
  },
  {
    key: 'task',
    label: t('templateWorkflows.useCaseFilter', 'Task'),
    options: useCaseOptions.value,
    selectedValues: activeUseCases.value,
    mode: 'multiple'
  },
  {
    key: 'runsOn',
    label: t('templateWorkflows.runsOnFilter', 'Runs on'),
    options: runsOnOptions.value,
    selectedValues: selectedRunsOn.value,
    mode: 'multiple'
  }
])

const toggleFilterValue = (facetKey: string, value: string) => {
  if (facetKey === 'category') {
    // Re-picking the active category clears it rather than doing nothing.
    selectedNavItem.value = selectedCategory.value === value ? 'all' : value
    return
  }
  const target =
    facetKey === 'model'
      ? selectedModels
      : facetKey === 'task'
        ? selectedUseCases
        : selectedRunsOn
  target.value = target.value.includes(value)
    ? target.value.filter((v) => v !== value)
    : [...target.value, value]
}

const clearFilterFacet = (facetKey: string) => {
  if (facetKey === 'category') selectedNavItem.value = 'all'
  else if (facetKey === 'model') selectedModels.value = []
  else if (facetKey === 'task') selectedUseCases.value = []
  else selectedRunsOn.value = []
}

interface AppliedFilter {
  facetKey: FilterFacetKey
  value: string
  label: string
}

/** Flattened for the pills row; the option label, not the raw value. */
const appliedFilters = computed<AppliedFilter[]>(() =>
  filterMenuFacets.value.flatMap((facet) =>
    facet.selectedValues
      .filter((value) => value !== facet.emptyValue)
      .map((value) => ({
        facetKey: facet.key as FilterFacetKey,
        value,
        label:
          facet.options.find((option) => option.value === value)?.name ?? value
      }))
  )
)

const filterChipClass = (active: boolean) =>
  cn(
    'h-7 cursor-pointer rounded-md border border-solid px-2.5 text-xs font-medium transition-colors outline-none',
    active
      ? 'border-transparent bg-base-foreground text-base-background'
      : 'border-border-subtle bg-transparent text-base-foreground hover:bg-secondary-background-hover'
  )

// UI state
const loadingTemplate = ref<string | null>(null)
const hoveredTemplate = ref<string | null>(null)
const cardRefs = ref<HTMLElement[]>([])

// Force re-render key for templates when sorting changes
const templateListKey = ref(0)

// Filter options
const modelOptions = computed(() =>
  availableModels.value.map((model) => ({ name: model, value: model }))
)

const useCaseOptions = computed(() =>
  availableUseCases.value.map((useCase) => ({ name: useCase, value: useCase }))
)

const runsOnOptions = computed(() =>
  availableRunsOn.value.map((runsOn) => ({ name: runsOn, value: runsOn }))
)

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

const selectSort = (value: string, close: () => void) => {
  sortSelection.value = value as TemplateSortMode
  close()
}

// Lazy pagination setup
const loadTrigger = ref<HTMLElement | null>(null)
const shouldUsePagination = computed(() => !searchQuery.value.trim())

const {
  paginatedItems: paginatedTemplates,
  isLoading: isLoadingMore,
  hasMoreItems: hasMoreTemplates,
  loadNextPage,
  reset: resetPagination
} = useLazyPagination(filteredTemplates, { itemsPerPage: 24 })

// Display templates (all when searching, paginated when not)
const displayTemplates = computed(() =>
  shouldUsePagination.value ? paginatedTemplates.value : filteredTemplates.value
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

// Palette mirrors the PM-243 proposal: green=ready, blue=download, amber=config.
const READINESS_STYLES: Record<
  TemplateReadinessState,
  { pill: string; dot: string; icon: string }
> = {
  ready: {
    pill: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    dot: 'bg-emerald-300',
    icon: 'text-emerald-300'
  },
  requiresDownload: {
    pill: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    dot: 'bg-sky-300',
    icon: 'text-sky-300'
  },
  needsConfiguration: {
    pill: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-300',
    icon: 'text-amber-300'
  },
  unverified: {
    pill: 'border-border-subtle bg-transparent text-muted-foreground',
    dot: 'bg-muted-foreground',
    icon: 'text-muted-foreground'
  }
}

interface DetailMetaField {
  label: string
  value?: string
  chips?: string[]
}

const metaFieldsFor = (template: TemplateInfo): DetailMetaField[] => {
  const { models, size, vram, useCase, license, date, requiresCustomNodes } =
    template
  const fields: DetailMetaField[] = []

  if (models?.length) {
    fields.push({ label: t('templateWorkflows.detail.models'), chips: models })
  }
  if (size) {
    fields.push({
      label: t('templateWorkflows.detail.modelSize'),
      value: formatSize(size)
    })
  }
  if (vram) {
    fields.push({
      label: t('templateWorkflows.detail.vram'),
      value: formatSize(vram)
    })
  }
  if (useCase) {
    fields.push({
      label: t('templateWorkflows.detail.useCase'),
      value: useCase
    })
  }
  if (license) {
    fields.push({
      label: t('templateWorkflows.detail.license'),
      value: license
    })
  }
  if (date) {
    fields.push({ label: t('templateWorkflows.detail.published'), value: date })
  }
  if (requiresCustomNodes?.length) {
    fields.push({
      label: t('templateWorkflows.detail.customNodes'),
      chips: requiresCustomNodes
    })
  }
  return fields
}

/**
 * Hover quick-info (Pablo, App Builder review 08-03): a floating card to the
 * right of the panel — same pattern as the node search preview — answering
 * "what does this template need to run?" without opening the detail. Shown
 * after a short delay so scanning the grid doesn't flicker; hidden on leave,
 * scroll, or when navigating into the detail.
 */

// Near-instant (Pablo, 08-05): the flyout is the whole point of hovering, and
// 350ms read as lag. Not zero — a few frames still absorb the pointer sweeping
// across the grid on its way somewhere else.
const HOVER_PREVIEW_DELAY_MS = 100
const HOVER_PREVIEW_WIDTH = 340
const HOVER_PREVIEW_MAX_HEIGHT = 380
const hoverPreview = ref<{
  template: TemplateInfo
  top: number
  left: number
} | null>(null)
const panelRootRef = ref<HTMLElement | null>(null)
let hoverTimer: number | null = null

/**
 * Position the flyout BESIDE the panel, like the node search preview: right
 * of the panel, or left of it when the panel sits against the right edge.
 * Overlapping the panel is the last resort for viewports with no side room.
 * Measured per hover (not a computed): panel/viewport geometry isn't
 * reactive, so a cached rect goes stale after any resize.
 */
const hoverPreviewLeftFor = () => {
  const rect = panelRootRef.value?.getBoundingClientRect()
  if (!rect) return 16
  const rightOfPanel = rect.right + 8
  if (rightOfPanel + HOVER_PREVIEW_WIDTH + 16 <= window.innerWidth) {
    return rightOfPanel
  }
  const leftOfPanel = rect.left - 8 - HOVER_PREVIEW_WIDTH
  if (leftOfPanel >= 16) {
    return leftOfPanel
  }
  return Math.max(16, window.innerWidth - HOVER_PREVIEW_WIDTH - 16)
}

const onCardEnter = (template: TemplateInfo, event: MouseEvent) => {
  hoveredTemplate.value = template.name
  const card = event.currentTarget as HTMLElement
  if (hoverTimer !== null) window.clearTimeout(hoverTimer)
  hoverTimer = window.setTimeout(() => {
    const top = Math.max(
      16,
      Math.min(
        card.getBoundingClientRect().top,
        window.innerHeight - HOVER_PREVIEW_MAX_HEIGHT
      )
    )
    hoverPreview.value = { template, top, left: hoverPreviewLeftFor() }
  }, HOVER_PREVIEW_DELAY_MS)
}

const onCardLeave = () => {
  hoveredTemplate.value = null
  if (hoverTimer !== null) window.clearTimeout(hoverTimer)
  hoverTimer = null
  hoverPreview.value = null
}

const hideHoverPreview = () => {
  if (hoverTimer !== null) window.clearTimeout(hoverTimer)
  hoverTimer = null
  hoverPreview.value = null
}

const hoverReadiness = computed(() =>
  hoverPreview.value ? getTemplateReadiness(hoverPreview.value.template) : null
)

const hoverMetaFields = computed<DetailMetaField[]>(() =>
  hoverPreview.value ? metaFieldsFor(hoverPreview.value.template) : []
)

const openTutorial = (template: TemplateInfo) => {
  if (template.tutorialUrl) {
    window.open(template.tutorialUrl, '_blank')
  }
}

const onLoadWorkflow = async (template: TemplateInfo) => {
  hideHoverPreview()
  loadingTemplate.value = template.name
  try {
    await loadWorkflowTemplate(
      template.name,
      getEffectiveSourceModule(template)
    )
    templateWasSelected.value = true
    closePanel()
  } finally {
    loadingTemplate.value = null
  }
}

// Initialize templates loading with useAsyncState
const { isLoading } = useAsyncState(
  async () => {
    await Promise.all([
      loadTemplates(),
      workflowTemplatesStore.loadWorkflowTemplates()
    ])
    return true
  },
  false,
  { immediate: true }
)

/**
 * The initial category is a guess (deep-link or new-user default) that may
 * not exist in this catalog — e.g. cloud has no getting-started category —
 * which rendered an inexplicable empty panel. Once the catalog is in, fall
 * back to All rather than showing zero results for a filter the user never
 * chose. One-shot: later user-selected categories are left alone even when
 * legitimately empty.
 */
const stopInitialCategoryGuard = watch(
  () => [isLoading.value, navigationFilteredTemplates.value.length] as const,
  ([loading, count]) => {
    if (loading) return
    if (count === 0 && selectedNavItem.value !== 'all') {
      selectedNavItem.value = 'all'
    }
    stopInitialCategoryGuard()
  }
)

onBeforeUnmount(() => {
  hideHoverPreview()
  cardRefs.value = [] // Release DOM refs
})
</script>
