import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { ComfyModelDef } from '@/stores/modelStore'
import type { EnrichedModel } from '@/platform/models/browser/types/modelBrowserTypes'
import { transformToEnrichedModel } from '@/platform/models/browser/utils/modelTransform'

import { useModelBrowserFiltering } from './useModelBrowserFiltering'

describe('useModelBrowserFiltering', () => {
  function createMockModels(): EnrichedModel[] {
    const checkpoint1 = new ComfyModelDef(
      'dreamshaper_8.safetensors',
      'checkpoints',
      0
    )
    checkpoint1.title = 'DreamShaper 8'

    const checkpoint2 = new ComfyModelDef(
      'realisticVision_v51.safetensors',
      'checkpoints',
      0
    )
    checkpoint2.title = 'Realistic Vision v5.1'

    const lora1 = new ComfyModelDef('detail_tweaker.safetensors', 'loras', 0)
    lora1.title = 'Detail Tweaker'

    return [
      transformToEnrichedModel(checkpoint1),
      transformToEnrichedModel(checkpoint2),
      transformToEnrichedModel(lora1)
    ]
  }

  it('should initialize with default state', () => {
    const models = createMockModels()
    const {
      searchQuery,
      selectedModelType,
      sortBy,
      sortDirection,
      filteredModels
    } = useModelBrowserFiltering(models)

    expect(searchQuery.value).toBe('')
    expect(selectedModelType.value).toBeNull()
    expect(sortBy.value).toBe('name')
    expect(sortDirection.value).toBe('asc')
    expect(filteredModels.value).toHaveLength(3)
  })

  it('should filter by model type', async () => {
    const models = createMockModels()
    const { selectedModelType, filteredModels } =
      useModelBrowserFiltering(models)

    selectedModelType.value = 'checkpoints'
    await vi.waitFor(() => {
      expect(filteredModels.value).toHaveLength(2)
      expect(
        filteredModels.value.every((m) => m.directory === 'checkpoints')
      ).toBe(true)
    })

    selectedModelType.value = 'loras'
    await vi.waitFor(() => {
      expect(filteredModels.value).toHaveLength(1)
      expect(filteredModels.value[0].directory).toBe('loras')
    })

    selectedModelType.value = null
    await vi.waitFor(() => {
      expect(filteredModels.value).toHaveLength(3)
    })
  })

  it('should filter by search query with fuzzy search', async () => {
    const models = createMockModels()
    const { searchQuery, debouncedSearchQuery, filteredModels } =
      useModelBrowserFiltering(models, {
        searchDebounce: 10
      })

    searchQuery.value = 'dreamshaper'
    await vi.waitFor(() => {
      return (
        debouncedSearchQuery.value === 'dreamshaper' &&
        filteredModels.value.length >= 1
      )
    })
    const dreamModel = filteredModels.value.find((m) =>
      m.displayName.includes('DreamShaper')
    )
    expect(dreamModel).toBeDefined()
    expect(dreamModel?.displayName).toBe('DreamShaper 8')

    searchQuery.value = 'realistic vision'
    await vi.waitFor(() => {
      return (
        debouncedSearchQuery.value === 'realistic vision' &&
        filteredModels.value.length >= 1
      )
    })
    const realisticModel = filteredModels.value.find((m) =>
      m.displayName.includes('Realistic')
    )
    expect(realisticModel).toBeDefined()
    expect(realisticModel?.displayName).toBe('Realistic Vision v5.1')
  })

  it('should be case-insensitive in search', async () => {
    const models = createMockModels()
    const { searchQuery, debouncedSearchQuery, filteredModels } =
      useModelBrowserFiltering(models, {
        searchDebounce: 10
      })

    searchQuery.value = 'DREAMSHAPER'
    await vi.waitFor(() => {
      return (
        debouncedSearchQuery.value === 'DREAMSHAPER' &&
        filteredModels.value.length >= 1
      )
    })
    const dreamModel = filteredModels.value.find((m) =>
      m.displayName.toLowerCase().includes('dream')
    )
    expect(dreamModel).toBeDefined()

    searchQuery.value = 'DreamShaper'
    await vi.waitFor(() => {
      return (
        debouncedSearchQuery.value === 'DreamShaper' &&
        filteredModels.value.length >= 1
      )
    })
    const dreamModel2 = filteredModels.value.find((m) =>
      m.displayName.toLowerCase().includes('dream')
    )
    expect(dreamModel2).toBeDefined()
  })

  it('should combine type filter and search', async () => {
    const models = createMockModels()
    const {
      searchQuery,
      debouncedSearchQuery,
      selectedModelType,
      filteredModels
    } = useModelBrowserFiltering(models, {
      searchDebounce: 10
    })

    selectedModelType.value = 'checkpoints'
    searchQuery.value = 'dream'

    await vi.waitFor(() => {
      return (
        debouncedSearchQuery.value === 'dream' &&
        filteredModels.value.length === 1
      )
    })
    expect(filteredModels.value[0].displayName).toBe('DreamShaper 8')

    searchQuery.value = 'detail'
    await vi.waitFor(() => {
      return (
        debouncedSearchQuery.value === 'detail' &&
        filteredModels.value.length === 0
      )
    })
  })

  it('should sort by name ascending', async () => {
    const models = createMockModels()
    const { sortBy, sortDirection, filteredModels } =
      useModelBrowserFiltering(models)

    sortBy.value = 'name'
    sortDirection.value = 'asc'

    await vi.waitFor(() => {
      expect(filteredModels.value[0].displayName).toBe('Detail Tweaker')
      expect(filteredModels.value[1].displayName).toBe('DreamShaper 8')
      expect(filteredModels.value[2].displayName).toBe('Realistic Vision v5.1')
    })
  })

  it('should sort by name descending', async () => {
    const models = createMockModels()
    const { sortBy, sortDirection, filteredModels } =
      useModelBrowserFiltering(models)

    sortBy.value = 'name'
    sortDirection.value = 'desc'

    await vi.waitFor(() => {
      expect(filteredModels.value[0].displayName).toBe('Realistic Vision v5.1')
      expect(filteredModels.value[1].displayName).toBe('DreamShaper 8')
      expect(filteredModels.value[2].displayName).toBe('Detail Tweaker')
    })
  })

  it('should sort by size', async () => {
    const models = createMockModels()
    models[0].size = 5000
    models[1].size = 3000
    models[2].size = 1000

    const { sortBy, sortDirection, filteredModels } =
      useModelBrowserFiltering(models)

    sortBy.value = 'size'
    sortDirection.value = 'asc'

    await vi.waitFor(() => {
      expect(filteredModels.value[0].size).toBe(1000)
      expect(filteredModels.value[1].size).toBe(3000)
      expect(filteredModels.value[2].size).toBe(5000)
    })

    sortDirection.value = 'desc'

    await vi.waitFor(() => {
      expect(filteredModels.value[0].size).toBe(5000)
      expect(filteredModels.value[1].size).toBe(3000)
      expect(filteredModels.value[2].size).toBe(1000)
    })
  })

  it('should handle undefined sizes when sorting', async () => {
    const models = createMockModels()
    models[0].size = 5000
    models[2].size = 3000

    const { sortBy, filteredModels } = useModelBrowserFiltering(models)

    sortBy.value = 'size'

    await vi.waitFor(() => {
      expect(filteredModels.value[0].size).toBe(3000)
      expect(filteredModels.value[1].size).toBe(5000)
      expect(filteredModels.value[2].size).toBeUndefined()
    })
  })

  it('should clear all filters', async () => {
    const models = createMockModels()
    const {
      searchQuery,
      selectedModelType,
      sortBy,
      sortDirection,
      clearFilters,
      filteredModels
    } = useModelBrowserFiltering(models)

    searchQuery.value = 'test'
    selectedModelType.value = 'checkpoints'
    sortBy.value = 'size'
    sortDirection.value = 'desc'

    clearFilters()

    expect(searchQuery.value).toBe('')
    expect(selectedModelType.value).toBeNull()
    expect(sortBy.value).toBe('name')
    expect(sortDirection.value).toBe('asc')

    await vi.waitFor(() => {
      expect(filteredModels.value).toHaveLength(3)
    })
  })

  it('should clear only search', async () => {
    const models = createMockModels()
    const {
      searchQuery,
      selectedModelType,
      sortBy,
      clearSearch,
      filteredModels
    } = useModelBrowserFiltering(models)

    searchQuery.value = 'test'
    selectedModelType.value = 'checkpoints'
    sortBy.value = 'size'

    clearSearch()

    expect(searchQuery.value).toBe('')
    expect(selectedModelType.value).toBe('checkpoints')
    expect(sortBy.value).toBe('size')

    await vi.waitFor(() => {
      expect(filteredModels.value).toHaveLength(2)
    })
  })

  it('should work with reactive model list', async () => {
    const models = ref(createMockModels())
    const { filteredModels } = useModelBrowserFiltering(models)

    expect(filteredModels.value).toHaveLength(3)

    const newModel = transformToEnrichedModel(
      new ComfyModelDef('new_model.safetensors', 'vae', 0)
    )
    models.value.push(newModel)

    await vi.waitFor(() => {
      expect(filteredModels.value).toHaveLength(4)
    })
  })

  it('should return empty array when no matches', async () => {
    const models = createMockModels()
    const { searchQuery, debouncedSearchQuery, filteredModels } =
      useModelBrowserFiltering(models, {
        searchDebounce: 10
      })

    searchQuery.value = 'nonexistent_model_xyz'

    await vi.waitFor(() => {
      return (
        debouncedSearchQuery.value === 'nonexistent_model_xyz' &&
        filteredModels.value.length === 0
      )
    })
  })
})
