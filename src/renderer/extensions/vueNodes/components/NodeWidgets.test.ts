import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  SafeWidgetData,
  VueNodeData
} from '@/composables/graph/useGraphNodeManager'

import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'

const mockDragState = reactive({
  active: false,
  pointerId: null as number | null,
  source: null,
  pointer: { client: { x: 0, y: 0 }, canvas: { x: 0, y: 0 } },
  candidate: null as {
    layout: { nodeId: string; index: number; type: string }
    compatible: boolean
  } | null,
  compatible: new Map<string, boolean>()
})

vi.mock('@/renderer/core/canvas/links/slotLinkDragUIState', () => ({
  useSlotLinkDragUIState: () => ({
    state: mockDragState,
    beginDrag: vi.fn(),
    endDrag: vi.fn(),
    updatePointerPosition: vi.fn(),
    setCandidate: vi.fn(),
    getSlotLayout: vi.fn(),
    setCompatibleMap: vi.fn(),
    setCompatibleForKey: vi.fn(),
    clearCompatible: vi.fn()
  })
}))

describe('NodeWidgets', () => {
  const createMockWidget = (
    overrides: Partial<SafeWidgetData> = {}
  ): SafeWidgetData => ({
    nodeId: 'test_node',
    name: 'test_widget',
    type: 'combo',
    options: undefined,
    callback: undefined,
    spec: undefined,
    isDOMWidget: false,
    slotMetadata: undefined,
    ...overrides
  })

  const createMockNodeData = (
    nodeType: string = 'TestNode',
    widgets: SafeWidgetData[] = []
  ): VueNodeData => ({
    id: '1',
    type: nodeType,
    widgets,
    title: 'Test Node',
    mode: 0,
    selected: false,
    executing: false,
    inputs: [],
    outputs: []
  })

  function resetDragState() {
    mockDragState.active = false
    mockDragState.candidate = null
    mockDragState.compatible.clear()
  }

  afterEach(() => {
    resetDragState()
  })

  const mountComponent = (nodeData?: VueNodeData) => {
    return mount(NodeWidgets, {
      props: {
        nodeData
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          // Stub InputSlot to avoid complex slot registration dependencies
          InputSlot: true
        },
        mocks: {
          $t: (key: string) => key
        }
      }
    })
  }

  describe('node-type prop passing', () => {
    it('passes node type to widget components', () => {
      const widget = createMockWidget()
      const nodeData = createMockNodeData('CheckpointLoaderSimple', [widget])
      const wrapper = mountComponent(nodeData)

      // Find the dynamically rendered widget component
      const widgetComponent = wrapper.find('.lg-node-widget')
      expect(widgetComponent.exists()).toBe(true)

      // Verify node-type prop is passed
      const component = widgetComponent.findComponent({ name: 'WidgetSelect' })
      if (component.exists()) {
        expect(component.props('nodeType')).toBe('CheckpointLoaderSimple')
      }
    })

    it('passes empty string when nodeData is undefined', () => {
      const wrapper = mountComponent(undefined)

      // No widgets should be rendered
      const widgetComponents = wrapper.findAll('.lg-node-widget')
      expect(widgetComponents).toHaveLength(0)
    })

    it('passes empty string when nodeData.type is undefined', () => {
      const widget = createMockWidget()
      const nodeData = createMockNodeData('', [widget])
      const wrapper = mountComponent(nodeData)

      const widgetComponent = wrapper.find('.lg-node-widget')
      if (widgetComponent.exists()) {
        const component = widgetComponent.findComponent({
          name: 'WidgetSelect'
        })
        if (component.exists()) {
          expect(component.props('nodeType')).toBe('')
        }
      }
    })

    it.for(['CheckpointLoaderSimple', 'LoraLoader', 'VAELoader', 'KSampler'])(
      'passes correct node type: %s',
      (nodeType) => {
        const widget = createMockWidget()
        const nodeData = createMockNodeData(nodeType, [widget])
        const wrapper = mountComponent(nodeData)

        const widgetComponent = wrapper.find('.lg-node-widget')
        expect(widgetComponent.exists()).toBe(true)

        const component = widgetComponent.findComponent({
          name: 'WidgetSelect'
        })
        if (component.exists()) {
          expect(component.props('nodeType')).toBe(nodeType)
        }
      }
    )
  })

  describe('drag hover indicator', () => {
    it('applies ring class when dragging a compatible link over a widget slot', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: false }
      })
      const nodeData = createMockNodeData('TestNode', [widget])

      mockDragState.active = true
      mockDragState.candidate = {
        layout: { nodeId: '1', index: 0, type: 'input' },
        compatible: true
      }

      const wrapper = mountComponent(nodeData)
      const widgetEl = wrapper.find('.lg-node-widget')
      expect(widgetEl.classes()).toContain('ring')
      expect(widgetEl.classes()).toContain('ring-component-node-widget-linked')
    })

    it('does not apply ring class when candidate is incompatible', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: false }
      })
      const nodeData = createMockNodeData('TestNode', [widget])

      mockDragState.active = true
      mockDragState.candidate = {
        layout: { nodeId: '1', index: 0, type: 'input' },
        compatible: false
      }

      const wrapper = mountComponent(nodeData)
      const widgetEl = wrapper.find('.lg-node-widget')
      expect(widgetEl.classes()).not.toContain('ring')
    })

    it('does not apply ring class when candidate targets a different node', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: false }
      })
      const nodeData = createMockNodeData('TestNode', [widget])

      mockDragState.active = true
      mockDragState.candidate = {
        layout: { nodeId: '99', index: 0, type: 'input' },
        compatible: true
      }

      const wrapper = mountComponent(nodeData)
      const widgetEl = wrapper.find('.lg-node-widget')
      expect(widgetEl.classes()).not.toContain('ring')
    })

    it('does not apply ring class when no drag is active', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: false }
      })
      const nodeData = createMockNodeData('TestNode', [widget])
      const wrapper = mountComponent(nodeData)
      const widgetEl = wrapper.find('.lg-node-widget')
      expect(widgetEl.classes()).not.toContain('ring')
    })

    it('does not apply ring class when widget has no slotMetadata', () => {
      const widget = createMockWidget({ slotMetadata: undefined })
      const nodeData = createMockNodeData('TestNode', [widget])

      mockDragState.active = true
      mockDragState.candidate = {
        layout: { nodeId: '1', index: 0, type: 'input' },
        compatible: true
      }

      const wrapper = mountComponent(nodeData)
      const widgetEl = wrapper.find('.lg-node-widget')
      expect(widgetEl.classes()).not.toContain('ring')
      expect(widgetEl.classes()).not.toContain('border-l-2')
    })

    it('does not apply ring class when candidate targets an output slot', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: false }
      })
      const nodeData = createMockNodeData('TestNode', [widget])

      mockDragState.active = true
      mockDragState.candidate = {
        layout: { nodeId: '1', index: 0, type: 'output' },
        compatible: true
      }

      const wrapper = mountComponent(nodeData)
      const widgetEl = wrapper.find('.lg-node-widget')
      expect(widgetEl.classes()).not.toContain('ring')
    })
  })

  describe('connected state indicator', () => {
    it('applies border class when widget slot is linked', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: true }
      })
      const nodeData = createMockNodeData('TestNode', [widget])
      const wrapper = mountComponent(nodeData)
      const widgetEl = wrapper.find('.lg-node-widget')
      expect(widgetEl.classes()).toContain('border-l-2')
      expect(widgetEl.classes()).toContain(
        'border-component-node-widget-linked'
      )
    })

    it('does not apply border class when widget slot is not linked', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: false }
      })
      const nodeData = createMockNodeData('TestNode', [widget])
      const wrapper = mountComponent(nodeData)
      const widgetEl = wrapper.find('.lg-node-widget')
      expect(widgetEl.classes()).not.toContain('border-l-2')
    })

    it('prefers drag hover ring over connected border when both apply', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: true }
      })
      const nodeData = createMockNodeData('TestNode', [widget])

      mockDragState.active = true
      mockDragState.candidate = {
        layout: { nodeId: '1', index: 0, type: 'input' },
        compatible: true
      }

      const wrapper = mountComponent(nodeData)
      const widgetEl = wrapper.find('.lg-node-widget')
      expect(widgetEl.classes()).toContain('ring')
      expect(widgetEl.classes()).not.toContain('border-l-2')
    })
  })

  describe('slot dot visibility during drag', () => {
    it('shows slot dots when drag is active', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: false }
      })
      const nodeData = createMockNodeData('TestNode', [widget])

      mockDragState.active = true

      const wrapper = mountComponent(nodeData)
      const dotContainer = wrapper.find('.lg-node-widget > div:first-child')
      expect(dotContainer.classes()).toContain('opacity-100')
      expect(dotContainer.classes()).not.toContain('opacity-0')
    })

    it('hides slot dots when no drag is active and not linked', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: false }
      })
      const nodeData = createMockNodeData('TestNode', [widget])
      const wrapper = mountComponent(nodeData)
      const dotContainer = wrapper.find('.lg-node-widget > div:first-child')
      expect(dotContainer.classes()).toContain('opacity-0')
    })

    it('shows slot dots when linked even without drag', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: true }
      })
      const nodeData = createMockNodeData('TestNode', [widget])
      const wrapper = mountComponent(nodeData)
      const dotContainer = wrapper.find('.lg-node-widget > div:first-child')
      expect(dotContainer.classes()).toContain('opacity-100')
      expect(dotContainer.classes()).not.toContain('opacity-0')
    })
  })

  describe('pointer-events during drag', () => {
    it('enables pointer-events on widget container during drag', () => {
      const widget = createMockWidget({
        slotMetadata: { index: 0, linked: false }
      })
      const nodeData = createMockNodeData('TestNode', [widget])

      mockDragState.active = true

      const wrapper = mountComponent(nodeData)
      const container = wrapper.find('.lg-node-widgets')
      expect(container.classes()).toContain('pointer-events-auto')
    })
  })
})
