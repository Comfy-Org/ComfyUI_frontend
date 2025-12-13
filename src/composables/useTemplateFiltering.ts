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

  const filteredBySearch = computed(() => {
    if (!debouncedSearchQuery.value.trim()) {
      return templatesArray.value
    }

    const results = fuse.value.search(debouncedSearchQuery.value)
    return results.map((result) => result.item)
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

  const sortedTemplates = computed(() => {
    const templates = [...filteredByRunsOn.value]

    switch (sortBy.value) {
      case 'default':
        // Curated: usage × 0.5 + internal × 0.3 + freshness × 0.2
        return templates.sort((a, b) => {
          const scoreA = rankingStore.computeDefaultScore(
            a.name,
            a.date,
            a.searchRank
          )
          const scoreB = rankingStore.computeDefaultScore(
            b.name,
            b.date,
            b.searchRank
          )
          return scoreB - scoreA
        })
      case 'popular':
        // User-driven: usage × 0.9 + freshness × 0.1
        return templates.sort((a, b) => {
          const scoreA = rankingStore.computePopularScore(a.name, a.date)
          const scoreB = rankingStore.computePopularScore(b.name, b.date)
          return scoreB - scoreA
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
          if (sizeA === sizeB) return 0
          return sizeA - sizeB
        })
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
