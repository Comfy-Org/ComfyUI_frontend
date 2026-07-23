import { watchDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import {
  createTemplateSearchIndex,
  searchTemplates
} from '@/composables/templateSearchConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useSearchQueryTracking } from '@/platform/telemetry/searchQuery/useSearchQueryTracking'
import { TemplateIncludeOnDistributionEnum } from '@/platform/workflow/templates/types/template'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { useTemplateRankingStore } from '@/stores/templateRankingStore'
import { debounce } from 'es-toolkit/compat'

type TemplateBrowseSort =
  | 'default'
  | 'recommended'
  | 'popular'
  | 'alphabetical'
  | 'newest'
  | 'vram-low-to-high'
  | 'model-size-low-to-high'

export type TemplateSortMode = TemplateBrowseSort | 'relevance'

/** The title shown on the card, trimmed for stable sorting. */
function displayTitle(template: TemplateInfo): string {
  return (
    template.localizedTitle ||
    template.title ||
    template.name ||
    ''
  ).trim()
}

/** A→Z by displayed title, with number-prefixed titles grouped after letters. */
function compareAlphabetical(a: TemplateInfo, b: TemplateInfo): number {
  const titleA = displayTitle(a)
  const titleB = displayTitle(b)
  const numericA = /^\d/.test(titleA)
  const numericB = /^\d/.test(titleB)
  if (numericA !== numericB) return numericA ? 1 : -1
  return titleA.localeCompare(titleB, undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

/**
 * Checks whether a template is visible for the given set of distributions.
 * Templates without `includeOnDistributions` are visible everywhere.
 */
function isTemplateVisibleForDistributions(
  template: TemplateInfo,
  distributions: TemplateIncludeOnDistributionEnum[]
): boolean {
  if (!template.includeOnDistributions?.length) return true
  return distributions.some((d) => template.includeOnDistributions!.includes(d))
}

export function useTemplateFiltering(
  templates: Ref<TemplateInfo[]> | TemplateInfo[]
) {
  const settingStore = useSettingStore()
  const systemStatsStore = useSystemStatsStore()
  const rankingStore = useTemplateRankingStore()

  const searchQuery = ref('')
  const selectedModels = ref<string[]>(
    settingStore.get('Comfy.Templates.SelectedModels')
  )
  const selectedUseCases = ref<string[]>(
    settingStore.get('Comfy.Templates.SelectedUseCases')
  )
  const selectedRunsOn = ref<string[]>(
    settingStore.get('Comfy.Templates.SelectedRunsOn')
  )
  const sortBy = ref<TemplateBrowseSort>(
    settingStore.get('Comfy.Templates.SortBy')
  )

  const templatesArray = computed(() => {
    const templateData = 'value' in templates ? templates.value : templates
    return Array.isArray(templateData) ? templateData : []
  })

  const distributions = computed<TemplateIncludeOnDistributionEnum[]>(() => {
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

  const visibleTemplates = computed(() => {
    return templatesArray.value.filter((t) =>
      isTemplateVisibleForDistributions(t, distributions.value)
    )
  })

  const searchIndex = computed(() =>
    createTemplateSearchIndex(visibleTemplates.value)
  )

  const availableModels = computed(() => {
    const modelSet = new Set<string>()
    visibleTemplates.value.forEach((template) => {
      if (Array.isArray(template.models)) {
        template.models.forEach((model) => modelSet.add(model))
      }
    })
    return Array.from(modelSet).sort()
  })

  const availableUseCases = computed(() => {
    const tagSet = new Set<string>()
    visibleTemplates.value.forEach((template) => {
      if (template.tags && Array.isArray(template.tags)) {
        template.tags.forEach((tag) => tagSet.add(tag))
      }
    })
    return Array.from(tagSet).sort()
  })

  const availableRunsOn = computed(() => {
    return ['ComfyUI', 'External or Remote API']
  })

  // Compute which selected filters are actually applicable to the current scope
  const activeModels = computed(() =>
    selectedModels.value.filter((model) =>
      availableModels.value.includes(model)
    )
  )

  const activeUseCases = computed(() =>
    selectedUseCases.value.filter((useCase) =>
      availableUseCases.value.includes(useCase)
    )
  )

  const inactiveModels = computed(() =>
    selectedModels.value.filter(
      (model) => !availableModels.value.includes(model)
    )
  )

  const inactiveUseCases = computed(() =>
    selectedUseCases.value.filter(
      (useCase) => !availableUseCases.value.includes(useCase)
    )
  )

  const hasActiveQuery = computed(() => searchQuery.value.trim().length > 0)
  const searchSort = ref<TemplateSortMode>('relevance')
  watch(hasActiveQuery, (searching) => {
    if (searching) searchSort.value = 'relevance'
  })
  const activeSort = computed(() =>
    hasActiveQuery.value ? searchSort.value : sortBy.value
  )

  const sortSelection = computed<TemplateSortMode>({
    get: () => activeSort.value,
    set: (value) => {
      // relevance is search-only; a browse sort chosen mid-search stays ephemeral.
      if (value === 'relevance' || hasActiveQuery.value)
        searchSort.value = value
      else sortBy.value = value
    }
  })

  const filteredBySearch = computed(() => {
    if (!hasActiveQuery.value) {
      return visibleTemplates.value
    }

    const templatesByName = new Map(
      visibleTemplates.value.map((template) => [template.name, template])
    )
    return searchTemplates(searchIndex.value, searchQuery.value)
      .map((name) => templatesByName.get(name))
      .filter((template): template is TemplateInfo => template !== undefined)
  })

  const filteredByModels = computed(() => {
    // Use active models instead of selected models for filtering
    if (activeModels.value.length === 0) {
      return filteredBySearch.value
    }

    return filteredBySearch.value.filter((template) => {
      if (!template.models || !Array.isArray(template.models)) {
        return false
      }
      return activeModels.value.some((activeModel) =>
        template.models?.includes(activeModel)
      )
    })
  })

  const filteredByUseCases = computed(() => {
    // Use active use cases instead of selected use cases for filtering
    if (activeUseCases.value.length === 0) {
      return filteredByModels.value
    }

    return filteredByModels.value.filter((template) => {
      if (!template.tags || !Array.isArray(template.tags)) {
        return false
      }
      return activeUseCases.value.some((activeUseCase) =>
        template.tags?.includes(activeUseCase)
      )
    })
  })

  const filteredByRunsOn = computed(() => {
    // RunsOn filters are scope-independent
    if (selectedRunsOn.value.length === 0) {
      return filteredByUseCases.value
    }

    return filteredByUseCases.value.filter((template) => {
      // Use openSource field to determine where template runs
      // openSource === false -> External/Remote API
      // openSource !== false -> ComfyUI (includes true and undefined)
      const isExternalAPI = template.openSource === false
      const isComfyUI = template.openSource !== false

      return selectedRunsOn.value.some((runsOn) => {
        if (runsOn === 'External or Remote API') {
          return isExternalAPI
        } else if (runsOn === 'ComfyUI') {
          return isComfyUI
        }
        return false
      })
    })
  })

  watch(
    filteredByRunsOn,
    (templates) => {
      rankingStore.largestUsageScore = templates.reduce(
        (max, template) => Math.max(max, template.usage ?? 0),
        0
      )
    },
    { immediate: true }
  )

  const sortedTemplates = computed(() => {
    const templates = [...filteredByRunsOn.value]

    switch (activeSort.value) {
      case 'relevance':
        return templates
      case 'recommended':
        // Curated: usage × 0.5 + internal × 0.3 + freshness × 0.2
        return templates.sort((a, b) => {
          const scoreA = rankingStore.computeDefaultScore(
            a.date,
            a.searchRank,
            a.usage
          )
          const scoreB = rankingStore.computeDefaultScore(
            b.date,
            b.searchRank,
            b.usage
          )
          return scoreB - scoreA
        })
      case 'popular':
        return templates.sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0))
      case 'alphabetical':
        return templates.sort(compareAlphabetical)
      case 'newest':
        return templates.sort((a, b) => {
          const dateA = new Date(a.date || '1970-01-01')
          const dateB = new Date(b.date || '1970-01-01')
          return dateB.getTime() - dateA.getTime()
        })
      case 'model-size-low-to-high':
        return templates.sort((a, b) => {
          const sizeA =
            typeof a.size === 'number' ? a.size : Number.POSITIVE_INFINITY
          const sizeB =
            typeof b.size === 'number' ? b.size : Number.POSITIVE_INFINITY
          if (sizeA === sizeB) return 0
          return sizeA - sizeB
        })
      case 'default':
      default:
        return templates
    }
  })

  const filteredTemplates = computed(() => sortedTemplates.value)

  const resetFilters = () => {
    searchQuery.value = ''
    selectedModels.value = []
    selectedUseCases.value = []
    selectedRunsOn.value = []
    sortBy.value = 'default'
    searchSort.value = 'relevance'
  }

  const removeModelFilter = (model: string) => {
    selectedModels.value = selectedModels.value.filter((m) => m !== model)
  }

  const removeUseCaseFilter = (tag: string) => {
    selectedUseCases.value = selectedUseCases.value.filter((t) => t !== tag)
  }

  const removeRunsOnFilter = (runsOn: string) => {
    selectedRunsOn.value = selectedRunsOn.value.filter((r) => r !== runsOn)
  }

  const filteredCount = computed(() => filteredTemplates.value.length)
  const totalCount = computed(() => visibleTemplates.value.length)
  useSearchQueryTracking('templates', searchQuery, filteredTemplates)

  // Template filter tracking (debounced to avoid excessive events)
  const debouncedTrackFilterChange = debounce(() => {
    useTelemetry()?.trackTemplateFilterChanged({
      search_query: searchQuery.value || undefined,
      selected_models: selectedModels.value,
      selected_use_cases: selectedUseCases.value,
      selected_runs_on: selectedRunsOn.value,
      sort_by: activeSort.value,
      filtered_count: filteredCount.value,
      total_count: totalCount.value
    })
  }, 500)

  // Watch for filter changes and track them
  watch(
    [searchQuery, selectedModels, selectedUseCases, selectedRunsOn, activeSort],
    () => {
      // Only track if at least one filter is active (to avoid tracking initial state)
      const hasActiveFilters =
        searchQuery.value.trim() !== '' ||
        selectedModels.value.length > 0 ||
        selectedUseCases.value.length > 0 ||
        selectedRunsOn.value.length > 0 ||
        activeSort.value !== 'default'

      if (hasActiveFilters) {
        debouncedTrackFilterChange()
      }
    },
    { deep: true }
  )

  // Persist filter changes to settings (debounced to avoid excessive saves)
  watchDebounced(
    selectedModels,
    (newValue) => {
      void settingStore.set('Comfy.Templates.SelectedModels', newValue)
    },
    { debounce: 500, deep: true }
  )

  watchDebounced(
    selectedUseCases,
    (newValue) => {
      void settingStore.set('Comfy.Templates.SelectedUseCases', newValue)
    },
    { debounce: 500, deep: true }
  )

  watchDebounced(
    selectedRunsOn,
    (newValue) => {
      void settingStore.set('Comfy.Templates.SelectedRunsOn', newValue)
    },
    { debounce: 500, deep: true }
  )

  watchDebounced(
    sortBy,
    (newValue) => {
      void settingStore.set('Comfy.Templates.SortBy', newValue)
    },
    { debounce: 500 }
  )

  return {
    // State
    searchQuery,
    selectedModels,
    selectedUseCases,
    selectedRunsOn,
    sortBy,
    sortSelection,
    hasActiveQuery,

    // Computed - Active filters (actually applied)
    activeModels,
    activeUseCases,

    // Computed - Inactive filters (selected but not applicable)
    inactiveModels,
    inactiveUseCases,

    // Computed
    filteredTemplates,
    availableModels,
    availableUseCases,
    availableRunsOn,
    filteredCount,
    totalCount,

    // Methods
    resetFilters,
    removeModelFilter,
    removeUseCaseFilter,
    removeRunsOnFilter
  }
}
