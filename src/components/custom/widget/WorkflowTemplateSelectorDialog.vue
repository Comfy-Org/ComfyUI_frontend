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
      <h2 class="text-neutral m-0 truncate text-xl font-semibold">
        {{ pageTitle }}
      </h2>
    </template>

    <template #header-right-area>
      <div class="flex items-center gap-2">
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
        <AsyncSearchInput
          v-model="searchInput"
          :searcher="applySearchQuery"
          :debounce-ms="400"
          :debounce-max-wait-ms="4000"
          class="h-10 w-96"
          autofocus
        />
      </div>
    </template>

    <template #contentFilter>
      <div
        class="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-2 pb-4"
      >
        <!-- Type tabs (left) -->
        <div class="flex shrink-0 items-center gap-2">
          <button
            v-for="tab in typeTabs"
            :key="tab.value"
            type="button"
            :aria-pressed="selectedType === tab.value"
            class="flex h-8 shrink-0 cursor-pointer appearance-none items-center gap-1 rounded-lg border-none text-xs whitespace-nowrap transition-colors"
            :class="
              selectedType === tab.value
                ? 'bg-base-foreground px-4 font-bold text-base-background'
                : 'bg-secondary-background px-3 font-medium text-white opacity-70 hover:opacity-100'
            "
            @click="selectedType = tab.value"
          >
            <i v-if="tab.icon" :class="tab.icon" class="size-3.5" />
            {{ tab.label }}
          </button>
        </div>

        <!-- Filters + Sort (right-aligned; the empty space sits between them
             and the tabs). They shrink/truncate to fit a single line and the
             whole group drops below the tabs only when it no longer fits. -->
        <div
          :ref="primeVueOverlay.overlayScopeRef"
          class="flex min-w-56 flex-1 items-center justify-end gap-2"
        >
          <!-- Model Filter -->
          <div class="min-w-0 shrink basis-[175px]">
            <MultiSelect
              v-model="selectedModelObjects"
              v-model:search-query="modelSearchText"
              size="md"
              class="w-full [&>div:first-child]:pl-1.5 [&>div:last-child]:px-1.5"
              :label="modelFilterLabel"
              :options="modelOptions"
              :content-style="selectContentStyle"
              :show-search-box="true"
              :show-selected-count="true"
              :show-clear-button="true"
            >
              <template #icon>
                <i class="icon-[lucide--cpu]" />
              </template>
            </MultiSelect>
          </div>

          <!-- Use Case Filter -->
          <div class="min-w-0 shrink basis-[133px]">
            <MultiSelect
              v-model="selectedUseCaseObjects"
              size="md"
              class="w-full [&>div:first-child]:pl-1.5 [&>div:last-child]:px-1.5"
              :label="useCaseFilterLabel"
              :options="useCaseOptions"
              :content-style="selectContentStyle"
              :show-search-box="true"
              :show-selected-count="true"
              :show-clear-button="true"
            >
              <template #icon>
                <i class="icon-[lucide--target]" />
              </template>
            </MultiSelect>
          </div>

          <!-- Runs On Filter -->
          <div class="min-w-0 shrink basis-[133px]">
            <MultiSelect
              v-model="selectedRunsOnObjects"
              size="md"
              class="w-full [&>div:first-child]:pl-1.5 [&>div:last-child]:px-1.5"
              :label="runsOnFilterLabel"
              :options="runsOnOptions"
              :content-style="selectContentStyle"
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
          <div class="min-w-0 shrink basis-[175px]">
            <SingleSelect
              v-model="sortSelection"
              size="md"
              :label="$t('templateWorkflows.sorting', 'Sort by')"
              :options="sortOptions"
              :content-style="selectContentStyle"
              class="w-full [&>div:first-child]:pl-1.5 [&>div:last-child]:px-1.5"
            >
              <template #icon>
                <i class="icon-[lucide--arrow-up-down] text-muted-foreground" />
              </template>
            </SingleSelect>
          </div>
        </div>
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
            v-for="template in isLoading ? [] : displayTemplates"
            :key="template.name"
            ref="cardRefs"
            size="tall"
            variant="ghost"
            rounded="lg"
            :data-testid="`template-workflow-${template.name}`"
            class="group/card hover:bg-base-background"
            @mouseenter="hoveredTemplate = template.name"
            @mouseleave="hoveredTemplate = null"
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
                        :hover-zoom="
                          template.thumbnailVariant === 'zoomHover' ? 16 : 5
                        "
                      />
                    </template>
                    <ProgressSpinner
                      v-if="loadingTemplate === template.name"
                      class="absolute inset-0 z-10 m-auto size-12"
                    />
                  </div>
                </template>
                <!-- Type badge (Node Graph / App) -->
                <template #top-left>
                  <div
                    class="flex h-7 items-center gap-1.5 rounded-lg bg-zinc-700/50 px-2 py-1.5 backdrop-blur-[20px]"
                  >
                    <i
                      :class="
                        isAppTemplate(template)
                          ? 'icon-[lucide--app-window]'
                          : 'icon-[comfy--workflow]'
                      "
                      class="size-4 text-white"
                    />
                    <span class="text-sm font-medium whitespace-nowrap text-white">
                      {{
                        isAppTemplate(template)
                          ? $t('builderToolbar.app', 'App')
                          : $t('builderToolbar.nodeGraph', 'Node Graph')
                      }}
                    </span>
                  </div>
                </template>
                <!-- Tutorial button (revealed on hover) -->
                <template v-if="template.tutorialUrl" #top-right>
                  <Button
                    v-tooltip.bottom="$t('g.seeTutorial')"
                    :aria-label="$t('g.seeTutorial')"
                    variant="inverted"
                    size="icon"
                    class="not-group-hover/card:opacity-0"
                    @click.stop="openTutorial(template)"
                  >
                    <i class="icon-[lucide--info] size-4" />
                  </Button>
                </template>
                <!-- Provider brand icons overlaid on the thumbnail -->
                <template v-if="getProviderInfo(template)" #bottom-right>
                  <div class="flex items-center gap-1">
                    <div
                      v-for="badge in getProviderInfo(template)!.visibleBadges"
                      :key="badge.provider"
                      class="flex size-6 items-center justify-center rounded-full bg-zinc-700/50 backdrop-blur-[20px]"
                    >
                      <i
                        v-if="badge.iconClass"
                        :class="badge.iconClass"
                        class="size-3.5 text-white"
                      />
                      <img
                        v-else
                        :src="badge.url"
                        :alt="badge.provider"
                        class="size-3.5 rounded-full object-contain"
                        draggable="false"
                      />
                    </div>
                    <div
                      v-if="getProviderInfo(template)!.extraCount > 0"
                      class="flex h-6 min-w-6 items-center justify-center rounded-full bg-zinc-700/50 px-1 text-[10px] font-medium text-white backdrop-blur-[20px]"
                    >
                      +{{ getProviderInfo(template)!.extraCount }}
                    </div>
                  </div>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom>
                <div class="flex flex-col gap-1 pt-2">
                  <!-- Title -->
                  <h3
                    class="m-0 line-clamp-1 text-sm font-semibold text-white"
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

                  <!-- Tags -->
                  <div
                    v-if="template.tags && template.tags.length > 0"
                    class="flex items-center gap-2 py-1"
                  >
                    <Tag
                      v-for="tag in getVisibleTags(template)"
                      :key="tag"
                      :label="tag"
                      shape="rounded"
                    />
                    <div
                      v-if="getExtraTagCount(template) > 0"
                      @mouseenter="showTagsPopover($event, template)"
                      @mouseleave="hideTagsPopover"
                      @click.stop
                    >
                      <Tag
                        :label="`+${getExtraTagCount(template)}`"
                        shape="rounded"
                        class="cursor-default"
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

      <!-- Shared tags popover (shown on hover of a card's "+N" tag chip) -->
      <Popover ref="tagsPopover">
        <div class="flex max-w-72 flex-col items-start gap-2">
          <Tag
            v-for="tag in popoverTags"
            :key="tag"
            :label="tag"
            shape="rounded"
          />
        </div>
      </Popover>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import Popover from 'primevue/popover'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import Tag from '@/components/chip/Tag.vue'
import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'
import MultiSelect from '@/components/ui/multi-select/MultiSelect.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import AudioThumbnail from '@/components/templates/thumbnails/AudioThumbnail.vue'
import CompareSliderThumbnail from '@/components/templates/thumbnails/CompareSliderThumbnail.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import HoverDissolveThumbnail from '@/components/templates/thumbnails/HoverDissolveThumbnail.vue'
import Button from '@/components/ui/button/Button.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useIntersectionObserver } from '@/composables/useIntersectionObserver'
import { useLazyPagination } from '@/composables/useLazyPagination'
import { usePrimeVueOverlayChildStyle } from '@/composables/usePopoverSizing'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import { useTelemetry } from '@/platform/telemetry'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'
import { createGridStyle } from '@/utils/gridUtil'

const { t, locale } = useI18n()

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
  loadWorkflowTemplate,
  getTemplateThumbnailUrl,
  getTemplateTitle
} = useTemplateWorkflows()

const getEffectiveSourceModule = (template: TemplateInfo) =>
  template.sourceModule || 'default'

const isAppTemplate = (template: TemplateInfo) => template.name.endsWith('.app')

/**
 * Format a list of provider names into a localized, human-readable string,
 * e.g. ['Google', 'Kling'] -> "Google and Kling".
 */
const formatProviderList = (providers: string[]): string => {
  try {
    return new Intl.ListFormat(String(locale.value), {
      style: 'long',
      type: 'conjunction'
    }).format(providers)
  } catch {
    return providers.join(t('templates.logoProviderSeparator'))
  }
}

/**
 * Provider display name -> monochrome comfy brand icon slug.
 * Only providers that ship a comfy icon are listed here; names that normalize
 * directly to an available slug (e.g. "ByteDance" -> "bytedance") are resolved
 * automatically, the rest are aliased below.
 */
const PROVIDER_ICON_ALIASES: Record<string, string> = {
  'black forest labs': 'bfl',
  google: 'gemini',
  stability: 'stability-ai',
  hunyuan: 'tencent',
  lightricks: 'ltxv'
}

/** Comfy brand icon slugs available as monochrome (masked) icons. */
const PROVIDER_ICON_SLUGS = new Set([
  'bfl',
  'bria',
  'bytedance',
  'elevenlabs',
  'gemini',
  'grok',
  'hitpaw',
  'ideogram',
  'kling',
  'ltxv',
  'luma',
  'magnific',
  'minimax',
  'openai',
  'pixverse',
  'recraft',
  'rodin',
  'runway',
  'sora',
  'stability-ai',
  'tencent',
  'topaz',
  'tripo',
  'veo',
  'vidu',
  'wan',
  'wavespeed'
])

/** Resolve a provider to its monochrome comfy icon class, or null if none. */
const getProviderIconClass = (provider: string): string | null => {
  const normalized = provider.trim().toLowerCase()
  const slug =
    PROVIDER_ICON_ALIASES[normalized] ?? normalized.replace(/[^a-z0-9]/g, '')
  return PROVIDER_ICON_SLUGS.has(slug) ? `icon-mask-[comfy--${slug}]` : null
}

interface ProviderBadge {
  provider: string
  /** Monochrome comfy icon class, or null when only a raster logo is available. */
  iconClass: string | null
  /** Fallback raster logo URL when no monochrome icon exists. */
  url: string
}

/** Max provider badges shown before collapsing the rest into a "+N" chip. */
const MAX_VISIBLE_LOGOS = 2

/**
 * Flatten a template's `logos` into a row of provider badges plus a label.
 * When more than `MAX_VISIBLE_LOGOS` providers exist the extra ones collapse
 * into a counter and the label becomes "Multiple providers".
 * Returns null when no valid provider could be resolved.
 */
const getProviderInfo = (
  template: TemplateInfo
): {
  visibleBadges: ProviderBadge[]
  extraCount: number
  label: string
} | null => {
  const logos = template.logos ?? []
  if (logos.length === 0) return null

  const badges: ProviderBadge[] = []
  const customLabels: string[] = []

  for (const logo of logos) {
    const providers = Array.isArray(logo.provider)
      ? logo.provider
      : [logo.provider]
    for (const provider of providers) {
      const iconClass = getProviderIconClass(provider)
      const url = workflowTemplatesStore.getLogoUrl(provider)
      if (iconClass || url) {
        badges.push({ provider, iconClass, url })
      }
    }
    if (logo.label) customLabels.push(logo.label)
  }

  if (badges.length === 0 && customLabels.length === 0) return null

  const extraCount = Math.max(0, badges.length - MAX_VISIBLE_LOGOS)
  const label =
    extraCount > 0
      ? t('templateWorkflows.multipleProviders', 'Multiple providers')
      : customLabels.length > 0
        ? customLabels.join(', ')
        : formatProviderList(badges.map((badge) => badge.provider))

  return {
    visibleBadges: badges.slice(0, MAX_VISIBLE_LOGOS),
    extraCount,
    label
  }
}

/** Number of tags shown before collapsing the rest into a "+N" chip. */
const MAX_VISIBLE_TAGS = 2

const getVisibleTags = (template: TemplateInfo): string[] =>
  (template.tags ?? []).slice(0, MAX_VISIBLE_TAGS)

const getExtraTagCount = (template: TemplateInfo): number =>
  Math.max(0, (template.tags?.length ?? 0) - MAX_VISIBLE_TAGS)

// Shared hover popover listing every tag of the hovered card.
const tagsPopover = ref<InstanceType<typeof Popover>>()
const popoverTags = ref<string[]>([])

const showTagsPopover = (event: MouseEvent, template: TemplateInfo) => {
  popoverTags.value = template.tags ?? []
  tagsPopover.value?.show(event)
}

const hideTagsPopover = () => {
  tagsPopover.value?.hide()
}

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

// Navigation
const selectedNavItem = ref<string | null>(initialCategory)

// Filter templates based on selected navigation item
const navigationFilteredTemplates = computed(() => {
  if (!selectedNavItem.value) {
    return allTemplates.value
  }

  return workflowTemplatesStore.filterTemplatesByCategory(selectedNavItem.value)
})

// Template type tabs (All / Node Graph / Apps)
type TemplateType = 'all' | 'nodeGraph' | 'apps'
const selectedType = ref<TemplateType>('all')

const typeTabs = computed<
  { value: TemplateType; label: string; icon: string | null }[]
>(() => [
  { value: 'all', label: t('templateWorkflows.type.all', 'All'), icon: null },
  {
    value: 'nodeGraph',
    label: t('builderToolbar.nodeGraph', 'Node Graph'),
    icon: 'icon-[comfy--workflow]'
  },
  {
    value: 'apps',
    label: t('builderToolbar.app', 'Apps'),
    icon: 'icon-[lucide--app-window]'
  }
])

const typeFilteredTemplates = computed(() => {
  const base = navigationFilteredTemplates.value
  if (selectedType.value === 'all') return base
  const wantApp = selectedType.value === 'apps'
  return base.filter((template) => isAppTemplate(template) === wantApp)
})

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
 * (e.g. via the "Clear Filters" button).
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

// Watch for changes from the two sources ('nav' and 'sort') and trigger the coordinator.
watch(selectedNavItem, () => coordinateNavAndSort('nav'))
watch(sortSelection, () => coordinateNavAndSort('sort'))

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
const primeVueOverlay = usePrimeVueOverlayChildStyle()
const selectContentStyle = primeVueOverlay.contentStyle

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
