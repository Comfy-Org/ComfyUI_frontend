import Fuse from 'fuse.js'
import { type Ref, computed, ref } from 'vue'

import type { TemplateInfo } from '@/types/workflowTemplateTypes'

export interface TemplateFilterOptions {
  searchQuery?: string
  selectedModels?: string[]
  sortBy?: 'recommended' | 'alphabetical' | 'newest'
}

export function useTemplateFiltering(
  templates: Ref<TemplateInfo[]> | TemplateInfo[]
) {
  const searchQuery = ref('')
  const selectedModels = ref<string[]>([])
  const sortBy = ref<'recommended' | 'alphabetical' | 'newest'>('recommended')

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
      if (template.models && Array.isArray(template.models)) {
        template.models.forEach((model) => modelSet.add(model))
      }
    })
    return Array.from(modelSet).sort()
  })

  const filteredBySearch = computed(() => {
    if (!searchQuery.value.trim()) {
      return templatesArray.value
    }

    const results = fuse.value.search(searchQuery.value)
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

  const sortedTemplates = computed(() => {
    const templates = [...filteredByModels.value]

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
      case 'recommended':
      default:
        // Keep original order (recommended order)
        return templates
    }
  })

  const filteredTemplates = computed(() => sortedTemplates.value)

  const resetFilters = () => {
    searchQuery.value = ''
    selectedModels.value = []
    sortBy.value = 'recommended'
  }

  const removeModelFilter = (model: string) => {
    selectedModels.value = selectedModels.value.filter((m) => m !== model)
  }

  const filteredCount = computed(() => filteredTemplates.value.length)
  const totalCount = computed(() => templatesArray.value.length)

  return {
    // State
    searchQuery,
    selectedModels,
    sortBy,

    // Computed
    filteredTemplates,
    availableModels,
    filteredCount,
    totalCount,

    // Methods
    resetFilters,
    removeModelFilter
  }
}
