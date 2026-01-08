import { refDebounced, watchDebounced } from '@vueuse/core'
import Fuse from 'fuse.js'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { useTemplateRankingStore } from '@/stores/templateRankingStore'
import { debounce } from 'es-toolkit/compat'

export function useTemplateFiltering(
  templates: Ref<TemplateInfo[]> | TemplateInfo[]
) {
  const settingStore = useSettingStore()
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
  const sortBy = ref<
    | 'default'
    | 'recommended'
    | 'popular'
    | 'alphabetical'
    | 'newest'
    | 'vram-low-to-high'
    | 'model-size-low-to-high'
  >(settingStore.get('Comfy.Templates.SortBy'))

  const templatesArray = computed(() => {
    const templateData = 'value' in templates ? templates.value : templates
    return Array.isArray(templateData) ? templateData : []
  })

  // Fuse.js configuration for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'name', weight: 0.3 },
      { name: 'title', weight: 0.3 },
      { name: 'description', weight: 0.1 },
      { name: 'tags', weight: 0.2 },
      { name: 'models', weight: 0.3 }
    ],
    threshold: 0.33,
    includeScore: true,
    includeMatches: true
  }

  const fuse = computed(() => new Fuse(templatesArray.value, fuseOptions))

  const availableModels = computed(() => {
    const modelSet = new Set<string>()
    templatesArray.value.forEach((template) => {
      if (Array.isArray(template.models)) {
        template.models.forEach((model) => modelSet.add(model))
      }
    })
    return Array.from(modelSet).sort()
  })

  const availableUseCases = computed(() => {
    const tagSet = new Set<string>()
    templatesArray.value.forEach((template) => {
      if (template.tags && Array.isArray(template.tags)) {
        template.tags.forEach((tag) => tagSet.add(tag))
      }
    })
    return Array.from(tagSet).sort()
  })

  const availableRunsOn = computed(() => {
    return ['ComfyUI', 'External or Remote API']
  })

  const debouncedSearchQuery = refDebounced(searchQuery, 50)

  // Store Fuse search results with scores for use in sorting
  const fuseSearchResults = computed(() => {
    if (!debouncedSearchQuery.value.trim()) {
      return null
    }
    return fuse.value.search(debouncedSearchQuery.value)
  })

  // Map of template name to search score (lower is better in Fuse, 0 = perfect match)
  const searchScoreMap = computed(() => {
    const map = new Map<string, number>()
    if (fuseSearchResults.value) {
      fuseSearchResults.value.forEach((result) => {
        // Store the score (0 = perfect match, 1 = worst match)
        map.set(result.item.name, result.score ?? 1)
      })
    }
    return map
  })

  const filteredBySearch = computed(() => {
    if (!fuseSearchResults.value) {
      return templatesArray.value
    }
    return fuseSearchResults.value.map((result) => result.item)
  })

  const filteredByModels = computed(() => {
    if (selectedModels.value.length === 0) {
      return filteredBySearch.value
    }

    return filteredBySearch.value.filter((template) => {
      if (!template.models || !Array.isArray(template.models)) {
        return false
      }
      return selectedModels.value.some((selectedModel) =>
        template.models?.includes(selectedModel)
      )
    })
  })

  const filteredByUseCases = computed(() => {
    if (selectedUseCases.value.length === 0) {
      return filteredByModels.value
    }

    return filteredByModels.value.filter((template) => {
      if (!template.tags || !Array.isArray(template.tags)) {
        return false
      }
      return selectedUseCases.value.some((selectedTag) =>
        template.tags?.includes(selectedTag)
      )
    })
  })

  const filteredByRunsOn = computed(() => {
    if (selectedRunsOn.value.length === 0) {
      return filteredByUseCases.value
    }

    return filteredByUseCases.value.filter((template) => {
      // Use openSource field to determine where template runs
      // openSource === false -> External/Remote API
      // openSource !== false -> ComfyUI (includes true and undefined)
      const isExternalAPI = template.openSource === false
      const isComfyUI = template.openSource !== false

      return selectedRunsOn.value.some((selectedRunsOn) => {
        if (selectedRunsOn === 'External or Remote API') {
          return isExternalAPI
        } else if (selectedRunsOn === 'ComfyUI') {
          return isComfyUI
        }
        return false
      })
    })
  })

  const getVramMetric = (template: TemplateInfo) => {
    if (
      typeof template.vram === 'number' &&
      Number.isFinite(template.vram) &&
      template.vram > 0
    ) {
      return template.vram
    }
    return Number.POSITIVE_INFINITY
  }

  watch(
    filteredByRunsOn,
    (templates) => {
      rankingStore.largestUsageScore = Math.max(
        ...templates.map((t) => t.usage || 0)
      )
    },
    { immediate: true }
  )

  // Helper to get search relevance score (higher is better, 0-1 range)
  // Fuse returns scores where 0 = perfect match, 1 = worst match
  // We invert it so higher = better for combining with other scores
  const getSearchRelevance = (template: TemplateInfo): number => {
    const fuseScore = searchScoreMap.value.get(template.name)
    if (fuseScore === undefined) return 0 // Not in search results or no search
    return 1 - fuseScore // Invert: 0 (worst) -> 1 (best)
  }

  const hasActiveSearch = computed(
    () => debouncedSearchQuery.value.trim() !== ''
  )

  const sortedTemplates = computed(() => {
    const templates = [...filteredByRunsOn.value]

    switch (sortBy.value) {
      case 'recommended':
        // When searching, heavily weight search relevance
        // Formula with search: searchRelevance × 0.6 + (usage × 0.5 + internal × 0.3 + freshness × 0.2) × 0.4
        // Formula without search: usage × 0.5 + internal × 0.3 + freshness × 0.2
        return templates.sort((a, b) => {
          const baseScoreA = rankingStore.computeDefaultScore(
            a.date,
            a.searchRank,
            a.usage
          )
          const baseScoreB = rankingStore.computeDefaultScore(
            b.date,
            b.searchRank,
            b.usage
          )

          if (hasActiveSearch.value) {
            const searchA = getSearchRelevance(a)
            const searchB = getSearchRelevance(b)
            const finalA = searchA * 0.6 + baseScoreA * 0.4
            const finalB = searchB * 0.6 + baseScoreB * 0.4
            return finalB - finalA
          }

          return baseScoreB - baseScoreA
        })
      case 'popular':
        // When searching, include search relevance
        // Formula with search: searchRelevance × 0.5 + (usage × 0.9 + freshness × 0.1) × 0.5
        // Formula without search: usage × 0.9 + freshness × 0.1
        return templates.sort((a, b) => {
          const baseScoreA = rankingStore.computePopularScore(a.date, a.usage)
          const baseScoreB = rankingStore.computePopularScore(b.date, b.usage)

          if (hasActiveSearch.value) {
            const searchA = getSearchRelevance(a)
            const searchB = getSearchRelevance(b)
            const finalA = searchA * 0.5 + baseScoreA * 0.5
            const finalB = searchB * 0.5 + baseScoreB * 0.5
            return finalB - finalA
          }

          return baseScoreB - baseScoreA
        })
      case 'alphabetical':
        return templates.sort((a, b) => {
          const nameA = a.title || a.name || ''
          const nameB = b.title || b.name || ''
          return nameA.localeCompare(nameB)
        })
      case 'newest':
        return templates.sort((a, b) => {
          const dateA = new Date(a.date || '1970-01-01')
          const dateB = new Date(b.date || '1970-01-01')
          return dateB.getTime() - dateA.getTime()
        })
      case 'vram-low-to-high':
        return templates.sort((a, b) => {
          const vramA = getVramMetric(a)
          const vramB = getVramMetric(b)

          if (vramA === vramB) {
            // Use search relevance as tiebreaker when searching
            if (hasActiveSearch.value) {
              const searchA = getSearchRelevance(a)
              const searchB = getSearchRelevance(b)
              if (searchA !== searchB) return searchB - searchA
            }
            const nameA = a.title || a.name || ''
            const nameB = b.title || b.name || ''
            return nameA.localeCompare(nameB)
          }

          if (vramA === Number.POSITIVE_INFINITY) return 1
          if (vramB === Number.POSITIVE_INFINITY) return -1

          return vramA - vramB
        })
      case 'model-size-low-to-high':
        return templates.sort((a, b) => {
          const sizeA =
            typeof a.size === 'number' ? a.size : Number.POSITIVE_INFINITY
          const sizeB =
            typeof b.size === 'number' ? b.size : Number.POSITIVE_INFINITY
          if (sizeA === sizeB) {
            // Use search relevance as tiebreaker when searching
            if (hasActiveSearch.value) {
              const searchA = getSearchRelevance(a)
              const searchB = getSearchRelevance(b)
              if (searchA !== searchB) return searchB - searchA
            }
            return 0
          }
          return sizeA - sizeB
        })
      case 'default':
      default:
        // 'default' preserves Fuse's search order (already sorted by relevance)
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
  const totalCount = computed(() => templatesArray.value.length)

  // Template filter tracking (debounced to avoid excessive events)
  const debouncedTrackFilterChange = debounce(() => {
    useTelemetry()?.trackTemplateFilterChanged({
      search_query: searchQuery.value || undefined,
      selected_models: selectedModels.value,
      selected_use_cases: selectedUseCases.value,
      selected_runs_on: selectedRunsOn.value,
      sort_by: sortBy.value,
      filtered_count: filteredCount.value,
      total_count: totalCount.value
    })
  }, 500)

  // Watch for filter changes and track them
  watch(
    [searchQuery, selectedModels, selectedUseCases, selectedRunsOn, sortBy],
    () => {
      // Only track if at least one filter is active (to avoid tracking initial state)
      const hasActiveFilters =
        searchQuery.value.trim() !== '' ||
        selectedModels.value.length > 0 ||
        selectedUseCases.value.length > 0 ||
        selectedRunsOn.value.length > 0 ||
        sortBy.value !== 'default'

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
