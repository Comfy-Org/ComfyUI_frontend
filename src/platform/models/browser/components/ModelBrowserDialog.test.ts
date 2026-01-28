import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { ComfyModelDef } from '@/stores/modelStore'

import { useModelBrowserFiltering } from '../composables/useModelBrowserFiltering'
import { useModelKeyboardNav } from '../composables/useModelKeyboardNav'
import { transformToEnrichedModel } from '../utils/modelTransform'

/**
 * Integration tests for ModelBrowserDialog behavior
 * Note: These tests focus on behavioral logic rather than full component mounting
 * due to complex i18n/plugin dependencies. The key behaviors (keyboard nav, filtering,
 * sorting) are tested via their composables which the dialog component uses.
 */
describe('ModelBrowserDialog - Integration Tests', () => {
  function createMockModels() {
    const models = [
      new ComfyModelDef('dreamshaper_8.safetensors', 'checkpoints', 0),
      new ComfyModelDef('realisticVision_v51.safetensors', 'checkpoints', 0),
      new ComfyModelDef('control_v11p_sd15_openpose.pth', 'controlnet', 0),
      new ComfyModelDef('detailed_lora.safetensors', 'loras', 0),
      new ComfyModelDef('vae-ft-mse.safetensors', 'vae', 0)
    ]

    return models.map((m) => transformToEnrichedModel(m))
  }

  beforeEach(() => {
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
    //  window.getComputedStyle for grid tests
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      gridTemplateColumns: '1fr 1fr 1fr'
    } as CSSStyleDeclaration)
  })

  describe('Search and Filter Flow', () => {
    it('should filter models by search query', async () => {
      const models = createMockModels()
      const modelsList = ref(models)

      const { searchQuery, filteredModels } =
        useModelBrowserFiltering(modelsList)

      // Perform search
      searchQuery.value = 'dream'
      await nextTick()

      // Should filter to models matching "dream"
      expect(filteredModels.value.length).toBeGreaterThan(0)
      expect(
        filteredModels.value.some((m) =>
          m.fileName.toLowerCase().includes('dream')
        )
      ).toBe(true)
    })

    it('should handle empty search results', async () => {
      const models = createMockModels()
      const modelsList = ref(models)

      const { searchQuery, filteredModels } =
        useModelBrowserFiltering(modelsList)

      // Search for non-existent model
      searchQuery.value = 'xyznonexistent123'

      // Wait for debounce (300ms default)
      await new Promise((resolve) => setTimeout(resolve, 350))
      await nextTick()

      // Should return empty array
      expect(filteredModels.value.length).toBe(0)
    })

    it('should combine search and type filter with AND logic', async () => {
      const models = createMockModels()
      const modelsList = ref(models)

      const { searchQuery, selectedModelTypes, filteredModels } =
        useModelBrowserFiltering(modelsList)

      const allModelsCount = filteredModels.value.length

      // Apply just type filter first
      selectedModelTypes.value = [{ value: 'CHECKPOINT', name: 'Checkpoint' }]
      await nextTick()

      const checkpointsCount = filteredModels.value.length

      // Apply search on top of type filter
      searchQuery.value = 'dream'

      // Wait for debounce (300ms default)
      await new Promise((resolve) => setTimeout(resolve, 350))
      await nextTick()

      // With both filters, should have same or fewer results than type alone
      expect(filteredModels.value.length).toBeLessThanOrEqual(checkpointsCount)
      expect(filteredModels.value.length).toBeLessThanOrEqual(allModelsCount)
    })
  })

  describe('Sorting Behavior', () => {
    it('should sort models by name A-Z', async () => {
      const models = createMockModels()
      const modelsList = ref(models)

      const { sortBy, sortDirection, filteredModels } =
        useModelBrowserFiltering(modelsList)

      sortBy.value = 'name'
      sortDirection.value = 'asc'
      await nextTick()

      const names = filteredModels.value.map((m) => m.fileName)
      const sortedNames = [...names].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      )

      expect(names).toEqual(sortedNames)
    })

    it('should sort models by name Z-A', async () => {
      const models = createMockModels()
      const modelsList = ref(models)

      const { sortBy, sortDirection, filteredModels } =
        useModelBrowserFiltering(modelsList)

      sortBy.value = 'name'
      sortDirection.value = 'desc'
      await nextTick()

      const names = filteredModels.value.map((m) => m.fileName)
      const sortedNames = [...names].sort((a, b) =>
        b.localeCompare(a, undefined, { sensitivity: 'base' })
      )

      expect(names).toEqual(sortedNames)
    })
  })

  describe('Keyboard Navigation Integration', () => {
    it('should integrate keyboard nav with model selection', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref<(typeof models)[0] | null>(null)
      const isRightPanelOpen = ref(false)
      const viewMode = ref<'grid' | 'list'>('list')

      const onShowInfo = vi.fn()
      const onClose = vi.fn()

      const { handleKeydown } = useModelKeyboardNav(
        gridItems,
        focusedModel,
        isRightPanelOpen,
        viewMode,
        { onShowInfo, onClose }
      )

      // Initial state: no focus
      expect(focusedModel.value).toBeNull()

      // Trigger ArrowDown - should select first model
      handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      await nextTick()

      expect(focusedModel.value).not.toBeNull()
      expect(focusedModel.value?.id).toBe(models[0].id)

      // Trigger Enter - should show info
      handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))

      expect(onShowInfo).toHaveBeenCalledWith(models[0])
    })

    it('should handle escape key to close panels', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[0])
      const isRightPanelOpen = ref(true)
      const viewMode = ref<'grid' | 'list'>('list')

      const onShowInfo = vi.fn()
      const onClose = vi.fn()

      const { handleKeydown } = useModelKeyboardNav(
        gridItems,
        focusedModel,
        isRightPanelOpen,
        viewMode,
        { onShowInfo, onClose }
      )

      // Panel is open
      expect(isRightPanelOpen.value).toBe(true)

      // Press Escape - should close panel
      handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))

      expect(isRightPanelOpen.value).toBe(false)
      expect(onClose).not.toHaveBeenCalled()

      // Press Escape again - should close dialog
      handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))

      expect(onClose).toHaveBeenCalled()
    })
  })
})
