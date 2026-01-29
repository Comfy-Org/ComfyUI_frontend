import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { ComfyModelDef } from '@/stores/modelStore'

import type { EnrichedModel } from '../types/modelBrowserTypes'
import { transformToEnrichedModel } from '../utils/modelTransform'
import { useModelKeyboardNav } from './useModelKeyboardNav'

describe('useModelKeyboardNav', () => {
  function createMockModels() {
    const models = [
      new ComfyModelDef('model1.safetensors', 'checkpoints', 0),
      new ComfyModelDef('model2.safetensors', 'checkpoints', 0),
      new ComfyModelDef('model3.safetensors', 'checkpoints', 0),
      new ComfyModelDef('model4.safetensors', 'checkpoints', 0),
      new ComfyModelDef('model5.safetensors', 'checkpoints', 0),
      new ComfyModelDef('model6.safetensors', 'checkpoints', 0)
    ]

    return models.map((m) => transformToEnrichedModel(m))
  }

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
  })

  describe('List Mode Navigation', () => {
    it('should move selection down by 1 on ArrowDown in list mode', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[0])
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

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      handleKeydown(event)

      await nextTick()

      expect(focusedModel.value.id).toBe(models[1].id)
    })

    it('should move selection up by 1 on ArrowUp in list mode', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[2])
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

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      handleKeydown(event)

      await nextTick()

      expect(focusedModel.value.id).toBe(models[1].id)
    })

    it('should not move beyond list boundaries', () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[models.length - 1])
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

      const lastModelId = focusedModel.value.id

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      handleKeydown(event)

      // Should remain at last item
      expect(focusedModel.value.id).toBe(lastModelId)
    })

    it('should select first item on ArrowDown when no selection', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref<EnrichedModel | null>(null)
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

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      handleKeydown(event)

      await nextTick()

      expect(focusedModel.value?.id).toBe(models[0].id)
    })
  })

  describe('Grid Mode Navigation', () => {
    beforeEach(() => {
      // Mock grid container and computed styles
      const mockGrid = document.createElement('div')
      mockGrid.className = 'grid'
      document.body.appendChild(mockGrid)

      // Mock getComputedStyle to return 3 columns
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        gridTemplateColumns: '1fr 1fr 1fr'
      } as CSSStyleDeclaration)
    })

    it('should move down by column count in grid mode', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[0])
      const isRightPanelOpen = ref(false)
      const viewMode = ref<'grid' | 'list'>('grid')

      const onShowInfo = vi.fn()
      const onClose = vi.fn()

      const { handleKeydown } = useModelKeyboardNav(
        gridItems,
        focusedModel,
        isRightPanelOpen,
        viewMode,
        { onShowInfo, onClose }
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      handleKeydown(event)

      await nextTick()

      // Should move down by 3 (column count)
      expect(focusedModel.value.id).toBe(models[3].id)
    })

    it('should move up by column count in grid mode', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[4])
      const isRightPanelOpen = ref(false)
      const viewMode = ref<'grid' | 'list'>('grid')

      const onShowInfo = vi.fn()
      const onClose = vi.fn()

      const { handleKeydown } = useModelKeyboardNav(
        gridItems,
        focusedModel,
        isRightPanelOpen,
        viewMode,
        { onShowInfo, onClose }
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      handleKeydown(event)

      await nextTick()

      // Should move up by 3 (column count)
      expect(focusedModel.value.id).toBe(models[1].id)
    })

    it('should move right by 1 in grid mode', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[0])
      const isRightPanelOpen = ref(false)
      const viewMode = ref<'grid' | 'list'>('grid')

      const onShowInfo = vi.fn()
      const onClose = vi.fn()

      const { handleKeydown } = useModelKeyboardNav(
        gridItems,
        focusedModel,
        isRightPanelOpen,
        viewMode,
        { onShowInfo, onClose }
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
      handleKeydown(event)

      await nextTick()

      expect(focusedModel.value.id).toBe(models[1].id)
    })

    it('should move left by 1 in grid mode', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[1])
      const isRightPanelOpen = ref(false)
      const viewMode = ref<'grid' | 'list'>('grid')

      const onShowInfo = vi.fn()
      const onClose = vi.fn()

      const { handleKeydown } = useModelKeyboardNav(
        gridItems,
        focusedModel,
        isRightPanelOpen,
        viewMode,
        { onShowInfo, onClose }
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
      handleKeydown(event)

      await nextTick()

      expect(focusedModel.value.id).toBe(models[0].id)
    })
  })

  describe('Enter Key - Opens Details', () => {
    it('should call onShowInfo when Enter is pressed', () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[0])
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

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      handleKeydown(event)

      expect(onShowInfo).toHaveBeenCalledWith(models[0])
    })

    it('should not call onShowInfo when no model is focused', () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref<EnrichedModel | null>(null)
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

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      handleKeydown(event)

      expect(onShowInfo).not.toHaveBeenCalled()
    })
  })

  describe('Escape Key - Closes Panel', () => {
    it('should close right panel first when Escape is pressed', () => {
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

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      handleKeydown(event)

      expect(isRightPanelOpen.value).toBe(false)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('should close dialog when Escape is pressed and right panel is closed', () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[0])
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

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      handleKeydown(event)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Input Field Focus - Skip Navigation', () => {
    it('should not navigate when typing in input field', () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[0])
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

      const input = document.createElement('input')
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      Object.defineProperty(event, 'target', { value: input, enumerable: true })

      handleKeydown(event)

      // Should not change focused model
      expect(focusedModel.value.id).toBe(models[0].id)
    })

    it('should not navigate when typing in textarea', () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[0])
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

      const textarea = document.createElement('textarea')
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      Object.defineProperty(event, 'target', {
        value: textarea,
        enumerable: true
      })

      handleKeydown(event)

      // Should not change focused model
      expect(focusedModel.value.id).toBe(models[0].id)
    })
  })

  describe('Focus Indicator', () => {
    it('should trigger scroll into view when model is focused', async () => {
      const models = createMockModels()
      const gridItems = ref(models.map((model) => ({ key: model.id, model })))
      const focusedModel = ref(models[0])
      const isRightPanelOpen = ref(false)
      const viewMode = ref<'grid' | 'list'>('list')

      // Create mock focused element
      const mockElement = document.createElement('div')
      mockElement.setAttribute('data-focused', 'true')
      document.body.appendChild(mockElement)

      const scrollSpy = vi.spyOn(mockElement, 'scrollIntoView')

      const onShowInfo = vi.fn()
      const onClose = vi.fn()

      const { handleKeydown } = useModelKeyboardNav(
        gridItems,
        focusedModel,
        isRightPanelOpen,
        viewMode,
        { onShowInfo, onClose }
      )

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      handleKeydown(event)

      await nextTick()

      expect(scrollSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      })
    })
  })
})
