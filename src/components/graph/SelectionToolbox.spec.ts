import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'
import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import { useExtensionService } from '@/services/extensionService'
import { useCanvasStore } from '@/stores/graphStore'

// Mock the composables and services
vi.mock('@/composables/graph/useCanvasInteractions', () => ({
  useCanvasInteractions: vi.fn(() => ({
    handleWheel: vi.fn()
  }))
}))

vi.mock('@/composables/canvas/useSelectionToolboxPosition', () => ({
  useSelectionToolboxPosition: vi.fn(() => ({
    visible: { value: true }
  })),
  resetMoreOptionsState: vi.fn()
}))

vi.mock('@/composables/element/useRetriggerableAnimation', () => ({
  useRetriggerableAnimation: vi.fn(() => ({
    shouldAnimate: { value: false }
  }))
}))

vi.mock('@/renderer/extensions/minimap/composables/useMinimap', () => ({
  useMinimap: vi.fn(() => ({
    containerStyles: {
      value: {
        backgroundColor: '#ffffff'
      }
    }
  }))
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: vi.fn(() => ({
    extensionCommands: { value: new Map() },
    invokeExtensions: vi.fn(() => [])
  }))
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => true),
  isImageNode: vi.fn(() => false)
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    getCommand: vi.fn(() => ({ id: 'test-command', title: 'Test Command' }))
  })
}))

describe('SelectionToolbox', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          info: 'Node Info',
          bookmark: 'Save to Library',
          frameNodes: 'Frame Nodes',
          moreOptions: 'More Options',
          refreshNode: 'Refresh Node'
        }
      }
    }
  })

  const mockProvide = {
    isVisible: { value: true },
    selectedItems: []
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()

    // Mock the canvas to avoid "getCanvas: canvas is null" errors
    canvasStore.canvas = {
      setDirty: vi.fn(),
      state: {
        selectionChanged: false
      }
    } as any

    vi.clearAllMocks()
  })

  const mountComponent = (props = {}) => {
    return mount(SelectionToolbox, {
      props,
      global: {
        plugins: [i18n, PrimeVue],
        provide: {
          [Symbol.for('SelectionOverlay')]: mockProvide
        },
        stubs: {
          Panel: {
            template:
              '<div class="panel selection-toolbox absolute left-1/2 rounded-lg"><slot /></div>',
            props: ['pt', 'style', 'class']
          },
          InfoButton: { template: '<div class="info-button" />' },
          ColorPickerButton: {
            template:
              '<button data-testid="color-picker-button" class="color-picker-button" />'
          },
          FrameNodes: { template: '<div class="frame-nodes" />' },
          PublishButton: {
            template:
              '<button data-testid="add-to-library" class="bookmark-button" />'
          },
          BypassButton: {
            template:
              '<button data-testid="bypass-button" class="bypass-button" />'
          },
          PinButton: { template: '<div class="pin-button" />' },
          Load3DViewerButton: {
            template: '<div class="load-3d-viewer-button" />'
          },
          MaskEditorButton: { template: '<div class="mask-editor-button" />' },
          DeleteButton: {
            template:
              '<button data-testid="delete-button" class="delete-button" />'
          },
          RefreshSelectionButton: {
            template: '<div class="refresh-button" />'
          },
          ExecuteButton: { template: '<div class="execute-button" />' },
          ConvertToSubgraphButton: {
            template:
              '<button data-testid="convert-to-subgraph-button" class="convert-to-subgraph-button" />'
          },
          ExtensionCommandButton: {
            template: '<div class="extension-command-button" />'
          },
          MoreOptions: {
            template:
              '<button data-testid="more-options-button" class="more-options" />'
          },
          VerticalDivider: { template: '<div class="vertical-divider" />' }
        }
      }
    })
  }

  describe('Button Visibility Logic', () => {
    beforeEach(() => {
      const mockExtensionService = vi.mocked(useExtensionService)
      mockExtensionService.mockReturnValue({
        extensionCommands: { value: new Map() },
        invokeExtensions: vi.fn(() => [])
      } as any)
    })

    it('should show info button only for single selections', () => {
      // Single node selection
      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()
      expect(wrapper.find('.info-button').exists()).toBe(true)

      // Multiple node selection
      canvasStore.selectedItems = [
        { type: 'TestNode1' },
        { type: 'TestNode2' }
      ] as any
      wrapper.unmount()
      const wrapper2 = mountComponent()
      expect(wrapper2.find('.info-button').exists()).toBe(false)
    })

    it('should show color picker for all selections', () => {
      // Single node selection
      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="color-picker-button"]').exists()).toBe(
        true
      )

      // Multiple node selection
      canvasStore.selectedItems = [
        { type: 'TestNode1' },
        { type: 'TestNode2' }
      ] as any
      wrapper.unmount()
      const wrapper2 = mountComponent()
      expect(
        wrapper2.find('[data-testid="color-picker-button"]').exists()
      ).toBe(true)
    })

    it('should show frame nodes only for multiple selections', () => {
      // Single node selection
      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()
      expect(wrapper.find('.frame-nodes').exists()).toBe(false)

      // Multiple node selection
      canvasStore.selectedItems = [
        { type: 'TestNode1' },
        { type: 'TestNode2' }
      ] as any
      wrapper.unmount()
      const wrapper2 = mountComponent()
      expect(wrapper2.find('.frame-nodes').exists()).toBe(true)
    })

    // it('should show bookmark button only for single subgraph selections', () => {
    //   const mockSubgraph = {
    //     type: 'SubgraphNode',
    //     isSubgraphNode: vi.fn(() => true)
    //   }

    //   // Single subgraph selection
    //   canvasStore.selectedItems = [mockSubgraph] as any
    //   const wrapper = mountComponent()
    //   expect(wrapper.find('[data-testid="add-to-library"]').exists()).toBe(true)

    //   // Single regular node selection
    //   canvasStore.selectedItems = [
    //     { type: 'TestNode', isSubgraphNode: vi.fn(() => false) }
    //   ] as any
    //   wrapper.unmount()
    //   const wrapper2 = mountComponent()
    //   expect(wrapper2.find('[data-testid="add-to-library"]').exists()).toBe(
    //     false
    //   )
    // })

    it('should show bypass button for appropriate selections', () => {
      // Single node selection
      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="bypass-button"]').exists()).toBe(true)

      // Multiple node selection
      canvasStore.selectedItems = [
        { type: 'TestNode1' },
        { type: 'TestNode2' }
      ] as any
      wrapper.unmount()
      const wrapper2 = mountComponent()
      expect(wrapper2.find('[data-testid="bypass-button"]').exists()).toBe(true)
    })

    it('should show common buttons for all selections', () => {
      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()

      expect(wrapper.find('[data-testid="delete-button"]').exists()).toBe(true)
      expect(
        wrapper.find('[data-testid="convert-to-subgraph-button"]').exists()
      ).toBe(true)
      expect(wrapper.find('[data-testid="more-options-button"]').exists()).toBe(
        true
      )
    })

    it('should show mask editor only for single image nodes', async () => {
      const mockUtils = await import('@/utils/litegraphUtil')
      const isImageNodeSpy = vi.spyOn(mockUtils, 'isImageNode')

      // Single image node
      isImageNodeSpy.mockReturnValue(true)
      canvasStore.selectedItems = [{ type: 'ImageNode' }] as any
      const wrapper = mountComponent()
      expect(wrapper.find('.mask-editor-button').exists()).toBe(true)

      // Single non-image node
      isImageNodeSpy.mockReturnValue(false)
      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      wrapper.unmount()
      const wrapper2 = mountComponent()
      expect(wrapper2.find('.mask-editor-button').exists()).toBe(false)
    })
  })

  describe('Divider Visibility Logic', () => {
    it('should show dividers between button groups when both groups have buttons', () => {
      // Setup single node to show info + other buttons
      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()

      const dividers = wrapper.findAll('.vertical-divider')
      expect(dividers.length).toBeGreaterThan(0)
    })

    it('should not show dividers when adjacent groups are empty', () => {
      // No selection should show minimal buttons and dividers
      canvasStore.selectedItems = []
      const wrapper = mountComponent()

      const buttons = wrapper.find('.panel').element.children
      expect(buttons.length).toBeGreaterThan(0) // At least MoreOptions should show
    })
  })

  describe('Extension Commands', () => {
    it('should render extension command buttons when available', () => {
      const mockExtensionService = vi.mocked(useExtensionService)
      mockExtensionService.mockReturnValue({
        extensionCommands: {
          value: new Map([
            ['test-command', { id: 'test-command', title: 'Test Command' }]
          ])
        },
        invokeExtensions: vi.fn(() => ['test-command'])
      } as any)

      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()

      expect(wrapper.find('.extension-command-button').exists()).toBe(true)
    })

    it('should not render extension commands when none available', () => {
      const mockExtensionService = vi.mocked(useExtensionService)
      mockExtensionService.mockReturnValue({
        extensionCommands: { value: new Map() },
        invokeExtensions: vi.fn(() => [])
      } as any)

      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()

      expect(wrapper.find('.extension-command-button').exists()).toBe(false)
    })
  })

  describe('Container Styling', () => {
    it('should apply minimap container styles', () => {
      const mockExtensionService = vi.mocked(useExtensionService)
      mockExtensionService.mockReturnValue({
        extensionCommands: { value: new Map() },
        invokeExtensions: vi.fn(() => [])
      } as any)

      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()

      const panel = wrapper.find('.panel')
      expect(panel.exists()).toBe(true)
    })

    it('should have correct CSS classes', () => {
      const mockExtensionService = vi.mocked(useExtensionService)
      mockExtensionService.mockReturnValue({
        extensionCommands: { value: new Map() },
        invokeExtensions: vi.fn(() => [])
      } as any)

      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()

      const panel = wrapper.find('.panel')
      expect(panel.classes()).toContain('selection-toolbox')
      expect(panel.classes()).toContain('absolute')
      expect(panel.classes()).toContain('left-1/2')
      expect(panel.classes()).toContain('rounded-lg')
    })

    it('should handle animation class conditionally', () => {
      const mockExtensionService = vi.mocked(useExtensionService)
      mockExtensionService.mockReturnValue({
        extensionCommands: { value: new Map() },
        invokeExtensions: vi.fn(() => [])
      } as any)

      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()

      const panel = wrapper.find('.panel')
      expect(panel.exists()).toBe(true)
    })
  })

  describe('Event Handling', () => {
    it('should handle wheel events', async () => {
      const mockCanvasInteractions = vi.mocked(useCanvasInteractions)
      const handleWheelSpy = vi.fn()
      mockCanvasInteractions.mockReturnValue({
        handleWheel: handleWheelSpy
      } as any)

      const mockExtensionService = vi.mocked(useExtensionService)
      mockExtensionService.mockReturnValue({
        extensionCommands: { value: new Map() },
        invokeExtensions: vi.fn(() => [])
      } as any)

      canvasStore.selectedItems = [{ type: 'TestNode' }] as any
      const wrapper = mountComponent()

      const panel = wrapper.find('.panel')
      await panel.trigger('wheel')

      expect(handleWheelSpy).toHaveBeenCalled()
    })
  })

  describe('No Selection State', () => {
    beforeEach(() => {
      const mockExtensionService = vi.mocked(useExtensionService)
      mockExtensionService.mockReturnValue({
        extensionCommands: { value: new Map() },
        invokeExtensions: vi.fn(() => [])
      } as any)
    })

    it('should still show MoreOptions when no items selected', () => {
      canvasStore.selectedItems = []
      const wrapper = mountComponent()

      expect(wrapper.find('.more-options').exists()).toBe(true)
    })

    it('should hide most buttons when no items selected', () => {
      canvasStore.selectedItems = []
      const wrapper = mountComponent()

      expect(wrapper.find('.info-button').exists()).toBe(false)
      expect(wrapper.find('.color-picker-button').exists()).toBe(false)
      expect(wrapper.find('.frame-nodes').exists()).toBe(false)
      expect(wrapper.find('.bookmark-button').exists()).toBe(false)
    })
  })
})
