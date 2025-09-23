import { refDebounced } from '@vueuse/core'
import Fuse from 'fuse.js'
import { type Ref, computed, ref } from 'vue'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

export function useTemplateFiltering(
  templates: Ref<TemplateInfo[]> | TemplateInfo[]
) {
  const searchQuery = ref('')
  const selectedModels = ref<string[]>([])
  const selectedUseCases = ref<string[]>([])
  const selectedLicenses = ref<string[]>([])
  const sortBy = ref<
    | 'default'
    | 'alphabetical'
    | 'newest'
    | 'vram-low-to-high'
    | 'model-size-low-to-high'
  >('newest')

  const templatesArray = computed(() => {
    const templateData = 'value' in templates ? templates.value : templates
    return Array.isArray(templateData) ? templateData : []
  })

  // Fuse.js configuration for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'name', weight: 0.3 },
      { name: 'title', weight: 0.3 },
      { name: 'description', weight: 0.2 },
      { name: 'tags', weight: 0.1 },
      { name: 'models', weight: 0.1 }
    ],
    threshold: 0.4,
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

  const availableLicenses = computed(() => {
    return ['Open Source', 'Closed Source (API Nodes)']
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

  const filteredByLicenses = computed(() => {
    if (selectedLicenses.value.length === 0) {
      return filteredByUseCases.value
    }

    return filteredByUseCases.value.filter((template) => {
      // Check if template has API in its tags or name (indicating it's a closed source API node)
      const isApiTemplate =
        template.tags?.includes('API') ||
        template.name?.toLowerCase().includes('api_')

      return selectedLicenses.value.some((selectedLicense) => {
        if (selectedLicense === 'Closed Source (API Nodes)') {
          return isApiTemplate
        } else if (selectedLicense === 'Open Source') {
          return !isApiTemplate
        }
        return false
      })
    })
  })

  const sortedTemplates = computed(() => {
    const templates = [...filteredByLicenses.value]

    switch (sortBy.value) {
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
        // TODO: Implement VRAM sorting when VRAM data is available
        // For now, keep original order
        return templates
      case 'model-size-low-to-high':
        return templates.sort((a: any, b: any) => {
          const sizeA =
            typeof a.size === 'number' ? a.size : Number.POSITIVE_INFINITY
          const sizeB =
            typeof b.size === 'number' ? b.size : Number.POSITIVE_INFINITY
          if (sizeA === sizeB) return 0
          return sizeA - sizeB
        })
      case 'default':
      default:
        // Keep original order (default order)
        return templates
    }
  })

  const filteredTemplates = computed(() => sortedTemplates.value)

  const resetFilters = () => {
    searchQuery.value = ''
    selectedModels.value = []
    selectedUseCases.value = []
    selectedLicenses.value = []
    sortBy.value = 'default'
  }

  const removeModelFilter = (model: string) => {
    selectedModels.value = selectedModels.value.filter((m) => m !== model)
  }

  const removeUseCaseFilter = (tag: string) => {
    selectedUseCases.value = selectedUseCases.value.filter((t) => t !== tag)
  }

  const removeLicenseFilter = (license: string) => {
    selectedLicenses.value = selectedLicenses.value.filter((l) => l !== license)
  }

  const filteredCount = computed(() => filteredTemplates.value.length)
  const totalCount = computed(() => templatesArray.value.length)

  return {
    // State
    searchQuery,
    selectedModels,
    selectedUseCases,
    selectedLicenses,
    sortBy,

    // Computed
    filteredTemplates,
    availableModels,
    availableUseCases,
    availableLicenses,
    filteredCount,
    totalCount,

    // Methods
    resetFilters,
    removeModelFilter,
    removeUseCaseFilter,
    removeLicenseFilter
  }
}
