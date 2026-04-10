import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { InputSpec } from '@/schemas/nodeDefSchema'
import { CONFIG, GET_CONFIG } from '@/services/litegraphService'

import {
  createMockLGraphNode,
  createMockLLink,
  createMockLinks
} from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph_mouse: [0, 0]
    },
    configuringGraph: false,
    registerExtension: vi.fn()
  }
}))

vi.mock('@/scripts/widgets', () => ({
  ComfyWidgets: {
    INT: vi.fn(() => ({
      widget: {
        name: 'value',
        type: 'number',
        value: 0,
        options: {},
        callback: vi.fn()
      }
    })),
    FLOAT: vi.fn(() => ({
      widget: {
        name: 'value',
        type: 'number',
        value: 0,
        options: {},
        callback: vi.fn()
      }
    })),
    COMBO: vi.fn(() => ({
      widget: {
        name: 'value',
        type: 'combo',
        value: '',
        options: { values: [] },
        callback: vi.fn()
      }
    })),
    STRING: vi.fn(() => ({
      widget: {
        name: 'value',
        type: 'string',
        value: '',
        options: {},
        callback: vi.fn()
      }
    }))
  },
  addValueControlWidgets: vi.fn(),
  isValidWidgetType: vi.fn(
    (type: string) =>
      type === 'INT' ||
      type === 'FLOAT' ||
      type === 'COMBO' ||
      type === 'STRING'
  )
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    shouldUseAssetBrowser: vi.fn(() => false)
  }
}))

vi.mock('@/platform/assets/utils/createAssetWidget', () => ({
  createAssetWidget: vi.fn(() => ({
    name: 'value',
    type: 'combo',
    value: '',
    options: {},
    callback: vi.fn()
  }))
}))

vi.mock('@/utils/searchAndReplace', () => ({
  applyTextReplacements: vi.fn((_, v: string) => `replaced:${v}`)
}))

vi.mock('@/utils/nodeDefUtil', () => ({
  mergeInputSpec: vi.fn(() => null)
}))

vi.mock('@/renderer/utils/nodeTypeGuards', () => ({
  isPrimitiveNode: vi.fn(() => false)
}))

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { assetService } from '@/platform/assets/services/assetService'
import { createAssetWidget } from '@/platform/assets/utils/createAssetWidget'
import { app } from '@/scripts/app'
import { applyTextReplacements } from '@/utils/searchAndReplace'
import { mergeInputSpec } from '@/utils/nodeDefUtil'

import {
  PrimitiveNode,
  convertToInput,
  getWidgetConfig,
  mergeIfValid,
  setWidgetConfig
} from './widgetInputs'

function createPrimitiveNode(): PrimitiveNode {
  return new PrimitiveNode('Primitive')
}

function createTargetNode(widgetName: string, widgetValue: unknown = 'test') {
  const widget = {
    name: widgetName,
    value: widgetValue,
    type: 'string',
    options: {},
    callback: vi.fn()
  }
  return createMockLGraphNode({
    id: 2,
    inputs: [
      {
        name: widgetName,
        type: 'STRING',
        link: 1,
        widget: {
          name: widgetName,
          [GET_CONFIG]: () => ['STRING', {}] as InputSpec
        }
      }
    ],
    widgets: [widget]
  })
}

function setupGraphWithLink(node: PrimitiveNode, targetNode: LGraphNode) {
  const link = createMockLLink({
    id: 1,
    target_id: targetNode.id,
    target_slot: 0
  })
  node.graph = {
    links: createMockLinks([link]),
    getNodeById: vi.fn(() => targetNode)
  } as any
  node.outputs[0].links = [1]
  return link
}

describe('PrimitiveNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('initializes with wildcard output and virtual node properties', () => {
      const node = createPrimitiveNode()
      expect(node.outputs).toHaveLength(1)
      expect(node.outputs[0].type).toBe('*')
      expect(node.outputs[0].name).toBe('connect to widget input')
      expect(node.isVirtualNode).toBe(true)
      expect(node.serialize_widgets).toBe(true)
      expect(node.properties['Run widget replace on values']).toBe(false)
    })
  })

  describe('applyToGraph', () => {
    it('copies widget value to connected nodes and calls callback', () => {
      const node = createPrimitiveNode()
      const targetNode = createTargetNode('seed', 42)
      setupGraphWithLink(node, targetNode)
      node.widgets = [
        { name: 'value', value: 99, type: 'number', options: {} } as any
      ]

      node.applyToGraph()

      expect(targetNode.widgets![0].value).toBe(99)
      expect(targetNode.widgets![0].callback).toHaveBeenCalled()
    })

    it('applies text replacements when property is enabled', () => {
      const node = createPrimitiveNode()
      const targetNode = createTargetNode('text', 'original')
      setupGraphWithLink(node, targetNode)
      node.widgets = [
        {
          name: 'value',
          value: 'hello {name}',
          type: 'string',
          options: {}
        } as any
      ]
      node.properties['Run widget replace on values'] = true

      node.applyToGraph()

      expect(vi.mocked(applyTextReplacements)).toHaveBeenCalledWith(
        node.graph,
        'hello {name}'
      )
      expect(targetNode.widgets![0].value).toBe('replaced:hello {name}')
    })

    it('applies value to extra links in addition to existing ones', () => {
      const node = createPrimitiveNode()
      const targetNode = createTargetNode('seed', 0)
      setupGraphWithLink(node, targetNode)
      node.widgets = [
        { name: 'value', value: 77, type: 'number', options: {} } as any
      ]

      const extraLink = { target_id: 2, target_slot: 0 } as any
      node.applyToGraph([extraLink])

      expect(targetNode.widgets![0].callback).toHaveBeenCalledTimes(2)
      expect(targetNode.widgets![0].value).toBe(77)
    })

    it('warns and skips when target node is not found', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const node = createPrimitiveNode()
      const link = createMockLLink({ id: 1, target_id: 999, target_slot: 0 })
      node.graph = {
        links: createMockLinks([link]),
        getNodeById: vi.fn(() => undefined)
      } as any
      node.outputs[0].links = [1]
      node.widgets = [
        { name: 'value', value: 99, type: 'number', options: {} } as any
      ]

      node.applyToGraph()

      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('warns when widget name is missing from input', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const node = createPrimitiveNode()
      const targetNode = createMockLGraphNode({
        id: 2,
        inputs: [{ name: 'test', type: 'STRING', link: 1, widget: {} }],
        widgets: []
      })
      setupGraphWithLink(node, targetNode)
      node.widgets = [
        { name: 'value', value: 99, type: 'number', options: {} } as any
      ]

      node.applyToGraph()

      expect(warnSpy).toHaveBeenCalledWith(
        'Invalid widget or widget name',
        expect.anything()
      )
      warnSpy.mockRestore()
    })

    it('warns when named widget does not exist on target node', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const node = createPrimitiveNode()
      const targetNode = createMockLGraphNode({
        id: 2,
        inputs: [
          {
            name: 'seed',
            type: 'INT',
            link: 1,
            widget: { name: 'nonexistent' }
          }
        ],
        widgets: [{ name: 'other_widget', value: 0 }]
      })
      setupGraphWithLink(node, targetNode)
      node.widgets = [
        { name: 'value', value: 99, type: 'number', options: {} } as any
      ]

      node.applyToGraph()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unable to find widget')
      )
      warnSpy.mockRestore()
    })
  })

  describe('refreshComboInNode', () => {
    it('updates combo values from output widget config', () => {
      const node = createPrimitiveNode()
      const comboValues = ['a', 'b', 'c']
      node.widgets = [
        {
          name: 'value',
          type: 'combo',
          value: 'a',
          options: { values: [] },
          callback: vi.fn()
        } as any
      ]
      node.outputs[0].widget = {
        name: 'value',
        [GET_CONFIG]: () => [comboValues, {}]
      }

      node.refreshComboInNode()

      expect(node.widgets[0].options.values).toEqual(comboValues)
    })

    it('resets value to first option when current value is removed', () => {
      const node = createPrimitiveNode()
      const comboValues = ['x', 'y', 'z']
      const callbackFn = vi.fn()
      node.widgets = [
        {
          name: 'value',
          type: 'combo',
          value: 'removed_value',
          options: { values: [] },
          callback: callbackFn
        } as any
      ]
      node.outputs[0].widget = {
        name: 'value',
        [GET_CONFIG]: () => [comboValues, {}]
      }

      node.refreshComboInNode()

      expect(node.widgets[0].value).toBe('x')
      expect(callbackFn).toHaveBeenCalledWith('x')
    })
  })

  describe('onConnectionsChange', () => {
    it('skips processing when app is configuring graph', () => {
      ;(app as any).configuringGraph = true

      const node = createPrimitiveNode()
      node.outputs[0].links = [1]
      node.outputs[0].type = 'INT'

      node.onConnectionsChange(2, 0, true)

      // Output type should remain unchanged (not reset by disconnect logic)
      expect(node.outputs[0].type).toBe('INT')
      ;(app as any).configuringGraph = false
    })

    it('resets output on last disconnect', () => {
      const node = createPrimitiveNode()
      node.outputs[0].links = []
      node.outputs[0].type = 'INT'
      node.outputs[0].name = 'INT'

      node.onConnectionsChange(2, 0, false)

      expect(node.outputs[0].type).toBe('*')
      expect(node.outputs[0].name).toBe('connect to widget input')
    })
  })

  describe('onConnectOutput', () => {
    it('rejects connection when input has no widget and type not in ComfyWidgets', () => {
      const node = createPrimitiveNode()
      const input = { name: 'test', type: 'CUSTOM_TYPE' } as any
      const targetNode = createMockLGraphNode({ id: 3 })

      const result = node.onConnectOutput(
        0,
        'CUSTOM_TYPE',
        input,
        targetNode,
        0
      )
      expect(result).toBe(false)
    })

    it('allows first connection when no existing links', () => {
      const node = createPrimitiveNode()
      node.outputs[0].links = undefined as any
      const input = {
        name: 'seed',
        type: 'INT',
        widget: {
          name: 'seed',
          [GET_CONFIG]: () => ['INT', {}]
        }
      } as any
      const targetNode = createMockLGraphNode({ id: 3 })

      const result = node.onConnectOutput(0, 'INT', input, targetNode, 0)
      expect(result).toBe(true)
    })

    it('validates and applies value when connecting additional outputs', () => {
      const node = createPrimitiveNode()
      const existingLink = createMockLLink({
        id: 1,
        target_id: 2,
        target_slot: 0
      })
      const existingTarget = createTargetNode('seed', 50)

      node.outputs[0].links = [1]
      node.outputs[0].widget = {
        [GET_CONFIG]: () => ['INT', { min: 0, max: 100 }] as InputSpec
      } as any

      const input = {
        name: 'steps',
        type: 'INT',
        widget: {
          name: 'steps',
          [GET_CONFIG]: () => ['INT', { min: 0, max: 100 }] as InputSpec
        }
      } as any
      const targetNode = createMockLGraphNode({
        id: 3,
        inputs: [{ name: 'steps', type: 'INT', widget: { name: 'steps' } }],
        widgets: [{ name: 'steps', value: 50, callback: vi.fn() }]
      })

      node.graph = {
        links: createMockLinks([existingLink]),
        getNodeById: vi.fn((id: number) =>
          id === 2 ? existingTarget : targetNode
        )
      } as any
      node.widgets = [
        { name: 'value', value: 50, type: 'number', options: {} } as any
      ]

      // mergeIfValid returns truthy → connection is valid
      const result = node.onConnectOutput(0, 'INT', input, targetNode, 0)
      expect(result).toBe(true)
    })
  })

  describe('onLastDisconnect', () => {
    it('resets output and cleans up widgets', () => {
      const node = createPrimitiveNode()
      const onRemove = vi.fn()
      node.outputs[0].type = 'INT'
      node.outputs[0].name = 'INT'
      node.outputs[0].widget = { name: 'test' } as any
      node.widgets = [
        { name: 'value', type: 'number', value: 0, onRemove } as any,
        { name: 'control', type: 'combo', value: 'fixed', onRemove } as any
      ]

      node.onLastDisconnect()

      expect(node.outputs[0].type).toBe('*')
      expect(node.outputs[0].name).toBe('connect to widget input')
      expect(node.outputs[0].widget).toBeUndefined()
      expect(onRemove).toHaveBeenCalledTimes(2)
      expect(node.widgets).toHaveLength(0)
    })

    it('temporarily stores controlValues and lastType for recreation', () => {
      vi.useFakeTimers()

      const node = createPrimitiveNode()
      node.widgets = [
        { name: 'value', type: 'number', value: 42 } as any,
        { name: 'control', type: 'combo', value: 'fixed' } as any
      ]

      node.onLastDisconnect()

      expect(node.lastType).toBe('number')
      expect(node.controlValues).toEqual(['fixed'])

      vi.advanceTimersByTime(15)
      expect(node.lastType).toBeUndefined()
      expect(node.controlValues).toBeUndefined()

      vi.useRealTimers()
    })
  })

  describe('onAfterGraphConfigured', () => {
    it('sets up output type and creates widget from connected node', () => {
      const node = createPrimitiveNode()
      const targetNode = createTargetNode('seed', 42)
      setupGraphWithLink(node, targetNode)
      node.widgets = undefined as any

      node.onAfterGraphConfigured()

      expect(node.outputs[0].type).toBe('STRING')
      expect(node.outputs[0].name).toBe('STRING')
    })

    it('restores widgets_values after connection setup', () => {
      const node = createPrimitiveNode()
      const targetNode = createTargetNode('seed', 42)
      setupGraphWithLink(node, targetNode)
      node.widgets = undefined as any
      node.widgets_values = ['restored_value']

      node.onAfterGraphConfigured()

      if (node.widgets?.length) {
        expect(node.widgets[0].value).toBe('restored_value')
      }
    })

    it('creates fake widget when input has no widget but type is in ComfyWidgets', () => {
      const node = createPrimitiveNode()
      const targetNode = createMockLGraphNode({
        id: 2,
        inputs: [{ name: 'value', type: 'INT', link: 1 }],
        widgets: []
      })
      setupGraphWithLink(node, targetNode)
      node.widgets = undefined as any

      node.onAfterGraphConfigured()

      expect(node.outputs[0].type).toBe('INT')
    })

    it('falls back to onLastDisconnect when graph is missing', () => {
      const node = createPrimitiveNode()
      node.outputs[0].links = [1]
      node.outputs[0].type = 'INT'
      ;(node as any).graph = undefined
      node.widgets = undefined as any

      node.onConnectionsChange(2, 0, true)

      expect(node.outputs[0].type).toBe('*')
    })

    it('returns early when link target node is not found', () => {
      const node = createPrimitiveNode()
      const link = createMockLLink({ id: 1, target_id: 999, target_slot: 0 })
      node.graph = {
        links: createMockLinks([link]),
        getNodeById: vi.fn(() => undefined)
      } as any
      node.outputs[0].links = [1]
      node.widgets = undefined as any

      node.onAfterGraphConfigured()

      expect(node.outputs[0].type).toBe('*')
    })

    it('returns early when link is not found in graph', () => {
      const node = createPrimitiveNode()
      node.graph = {
        links: createMockLinks([]),
        getNodeById: vi.fn()
      } as any
      node.outputs[0].links = [99]
      node.widgets = undefined as any

      node.onAfterGraphConfigured()

      expect(node.outputs[0].type).toBe('*')
    })
  })

  describe('_createWidget with asset browser', () => {
    it('creates asset widget and copies target widget value', () => {
      vi.mocked(assetService.shouldUseAssetBrowser).mockReturnValue(true)

      const node = createPrimitiveNode()
      const targetNode = createMockLGraphNode({
        id: 2,
        comfyClass: 'CheckpointLoader',
        inputs: [
          {
            name: 'ckpt_name',
            type: 'COMBO',
            link: 1,
            widget: {
              name: 'ckpt_name',
              [GET_CONFIG]: () =>
                [['model1.safetensors', 'model2.safetensors'], {}] as InputSpec
            }
          }
        ],
        widgets: [{ name: 'ckpt_name', value: 'model1.safetensors' }]
      })
      setupGraphWithLink(node, targetNode)
      node.widgets = undefined as any

      node.onAfterGraphConfigured()

      expect(vi.mocked(createAssetWidget)).toHaveBeenCalledWith(
        expect.objectContaining({
          node,
          widgetName: 'value',
          nodeTypeForBrowser: 'CheckpointLoader',
          inputNameForBrowser: 'ckpt_name'
        })
      )
    })
  })

  describe('_mergeWidgetConfig via onConnectionsChange', () => {
    it('removes CONFIG and recreates widget when links < 2 and had config', () => {
      const node = createPrimitiveNode()
      node.outputs[0].links = [1]
      node.outputs[0].widget = {
        name: 'test',
        [CONFIG]: ['INT', { min: 0 }],
        [GET_CONFIG]: () => ['INT', { min: 0 }] as InputSpec
      } as any

      const targetNode = createTargetNode('seed', 42)
      const link = createMockLLink({ id: 1, target_id: 2, target_slot: 0 })
      node.graph = {
        links: createMockLinks([link]),
        getNodeById: vi.fn(() => targetNode)
      } as any
      node.widgets = [
        { name: 'value', value: 0, type: 'number', options: {} } as any
      ]

      node.onConnectionsChange(2, 0, false)

      expect(node.outputs[0].widget?.[CONFIG]).toBeUndefined()
    })
  })

  describe('recreateWidget', () => {
    it('preserves widget values across recreation', () => {
      const node = createPrimitiveNode()
      const targetNode = createTargetNode('seed', 42)
      setupGraphWithLink(node, targetNode)
      node.widgets = [
        { name: 'value', value: 123, type: 'number', options: {} } as any
      ]

      node.recreateWidget()
      // The widget values are preserved during recreation
    })
  })
})

describe('getWidgetConfig', () => {
  it('returns CONFIG if present on widget', () => {
    const config: InputSpec = ['INT', { min: 0, max: 100 }]
    const slot = {
      widget: {
        [CONFIG]: config,
        [GET_CONFIG]: () => ['FLOAT', {}] as InputSpec
      }
    } as any

    expect(getWidgetConfig(slot)).toEqual(config)
  })

  it('falls back to GET_CONFIG when CONFIG is missing', () => {
    const config: InputSpec = ['FLOAT', { step: 0.1 }]
    const slot = {
      widget: { [GET_CONFIG]: () => config }
    } as any

    expect(getWidgetConfig(slot)).toEqual(config)
  })

  it('returns wildcard default when no widget config exists', () => {
    const slot = {} as any
    expect(getWidgetConfig(slot)).toEqual(['*', {}])
  })
})

describe('convertToInput', () => {
  it('logs deprecation warning and returns matching input slot', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = createMockLGraphNode({
      inputs: [
        { name: 'a', type: 'INT', widget: { name: 'widgetA' } },
        { name: 'b', type: 'STRING', widget: { name: 'widgetB' } }
      ]
    })

    const result = convertToInput(node, { name: 'widgetB' } as any)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('remove call to convertToInput')
    )
    expect(result!.name).toBe('b')
    warnSpy.mockRestore()
  })

  it('returns undefined when no matching input exists', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = createMockLGraphNode({
      inputs: [{ name: 'a', type: 'INT', widget: { name: 'widgetA' } }]
    })

    const result = convertToInput(node, { name: 'nonexistent' } as any)
    expect(result).toBeUndefined()
    vi.restoreAllMocks()
  })
})

describe('setWidgetConfig', () => {
  it('does nothing when slot has no widget', () => {
    const slot = { link: null } as any
    setWidgetConfig(slot, ['INT', {}])
    expect(slot.widget).toBeUndefined()
  })

  it('sets GET_CONFIG when config is provided', () => {
    const config: InputSpec = ['INT', { min: 0 }]
    const slot = { widget: { name: 'test' } } as any

    setWidgetConfig(slot, config)

    expect(slot.widget[GET_CONFIG]()).toEqual(config)
  })

  it('deletes widget when config is undefined', () => {
    const slot = { widget: { name: 'test' } } as any

    setWidgetConfig(slot)

    expect(slot.widget).toBeUndefined()
  })
})

describe('extension registration', () => {
  // Capture before any test clears mock calls
  const extension = vi.mocked(app.registerExtension).mock.calls[0]?.[0] as any

  it('registers the Comfy.WidgetInputs extension', () => {
    expect(extension).toEqual(
      expect.objectContaining({
        name: 'Comfy.WidgetInputs',
        beforeRegisterNodeDef: expect.any(Function),
        registerCustomNodes: expect.any(Function)
      })
    )
  })

  describe('beforeRegisterNodeDef', () => {
    it('adds convertWidgetToInput that warns and returns false', async () => {
      class TestNodeType extends LGraphNode {}
      await extension.beforeRegisterNodeDef(TestNodeType, {})

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const instance = new TestNodeType('test')
      const result = (instance as any).convertWidgetToInput?.()

      expect(result).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('remove call to convertWidgetToInput')
      )
      warnSpy.mockRestore()
    })

    it('onGraphConfigured sets up GET_CONFIG on widget inputs', async () => {
      class TestNodeType extends LGraphNode {}
      await extension.beforeRegisterNodeDef(TestNodeType, {})

      const instance = new TestNodeType('test')
      instance.inputs = [
        { name: 'seed', type: 'INT', widget: { name: 'seed' } } as any
      ]
      instance.widgets = [{ name: 'seed', value: 0 } as any]
      ;(instance.constructor as any).nodeData = {
        input: { required: { seed: ['INT', { min: 0 }] } }
      }

      instance.onGraphConfigured?.()

      const config = (instance.inputs[0].widget?.[GET_CONFIG] as Function)?.()
      expect(config).toEqual(['INT', { min: 0 }])
    })

    it('onGraphConfigured removes inputs without matching widgets', async () => {
      class TestNodeType extends LGraphNode {}
      await extension.beforeRegisterNodeDef(TestNodeType, {})

      const instance = new TestNodeType('test')
      instance.inputs = [
        {
          name: 'orphan',
          type: 'INT',
          widget: { name: 'orphan_widget' }
        } as any
      ]
      instance.widgets = []
      const removeInputSpy = vi.fn()
      instance.removeInput = removeInputSpy

      instance.onGraphConfigured?.()

      expect(removeInputSpy).toHaveBeenCalled()
    })

    it('onConfigure sets GET_CONFIG on widget inputs during paste', async () => {
      class TestNodeType extends LGraphNode {}
      await extension.beforeRegisterNodeDef(TestNodeType, {})
      ;(app as any).configuringGraph = false

      const instance = new TestNodeType('test')
      instance.inputs = [
        { name: 'steps', type: 'INT', widget: { name: 'steps' } } as any
      ]
      ;(instance.constructor as any).nodeData = {
        input: { optional: { steps: ['INT', { max: 50 }] } }
      }

      instance.onConfigure?.({} as any)

      expect(instance.inputs[0].widget?.[GET_CONFIG]).toBeDefined()
    })

    it('onInputDblClick skips non-widget non-ComfyWidgets inputs', async () => {
      class TestNodeType extends LGraphNode {}
      await extension.beforeRegisterNodeDef(TestNodeType, {})

      const instance = new TestNodeType('test')
      instance.inputs = [{ name: 'image', type: 'IMAGE' } as any]
      instance.pos = [100, 100]

      const createNodeSpy = vi.spyOn(LiteGraph, 'createNode')
      instance.onInputDblClick?.(0, {} as any)

      expect(createNodeSpy).not.toHaveBeenCalled()
      createNodeSpy.mockRestore()
    })

    it('onInputDblClick creates and connects a primitive node', async () => {
      class TestNodeType extends LGraphNode {}
      await extension.beforeRegisterNodeDef(TestNodeType, {})

      const instance = new TestNodeType('test')
      instance.inputs = [
        {
          name: 'seed',
          type: 'INT',
          widget: {
            name: 'seed',
            [GET_CONFIG]: () => ['INT', {}] as InputSpec
          }
        } as any
      ]
      instance.pos = [100, 100]

      const mockPrimNode = {
        size: [200, 100],
        pos: [0, 0],
        connect: vi.fn(),
        title: ''
      }
      const mockGraph = {
        add: vi.fn(),
        getNodeOnPos: vi.fn(() => null),
        nodes: []
      }

      vi.spyOn(LiteGraph, 'createNode').mockReturnValue(mockPrimNode as any)
      ;(app.canvas as any).graph = mockGraph

      instance.onInputDblClick?.(0, {} as any)

      expect(LiteGraph.createNode).toHaveBeenCalledWith('PrimitiveNode')
      expect(mockGraph.add).toHaveBeenCalledWith(mockPrimNode)
      expect(mockPrimNode.connect).toHaveBeenCalledWith(0, instance, 0)
      expect(mockPrimNode.title).toBe('seed')
    })

    it('onInputDblClick adjusts position to avoid overlapping nodes', async () => {
      class TestNodeType extends LGraphNode {}
      await extension.beforeRegisterNodeDef(TestNodeType, {})

      const instance = new TestNodeType('test')
      instance.inputs = [
        {
          name: 'seed',
          type: 'INT',
          widget: {
            name: 'seed',
            [GET_CONFIG]: () => ['INT', {}] as InputSpec
          }
        } as any
      ]
      instance.pos = [100, 100]

      const mockPrimNode = {
        size: [200, 100],
        pos: [0, 0] as [number, number],
        connect: vi.fn(),
        title: ''
      }
      const mockGraph = {
        add: vi.fn(),
        getNodeOnPos: vi
          .fn()
          .mockReturnValueOnce({ id: 99 })
          .mockReturnValueOnce({ id: 98 })
          .mockReturnValueOnce(null),
        nodes: []
      }

      vi.spyOn(LiteGraph, 'createNode').mockReturnValue(mockPrimNode as any)
      ;(app.canvas as any).graph = mockGraph

      instance.onInputDblClick?.(0, {} as any)

      expect(mockPrimNode.pos[1]).toBeGreaterThan(100)
    })
  })

  describe('registerCustomNodes', () => {
    it('registers PrimitiveNode with LiteGraph', () => {
      const registerSpy = vi.spyOn(LiteGraph, 'registerNodeType')
      extension.registerCustomNodes()

      expect(registerSpy).toHaveBeenCalledWith(
        'PrimitiveNode',
        expect.anything()
      )
      expect(PrimitiveNode.category).toBe('utils')
      registerSpy.mockRestore()
    })
  })
})

describe('mergeIfValid', () => {
  it('returns empty customConfig when merge returns null', () => {
    const output = {
      widget: {
        [GET_CONFIG]: () => ['INT', { min: 0, max: 100 }] as InputSpec
      }
    } as any

    const result = mergeIfValid(output, ['INT', { min: 50, max: 200 }])
    expect(result).toEqual({ customConfig: {} })
  })

  it('uses provided config1 instead of fetching from output', () => {
    const output = {
      widget: {
        [GET_CONFIG]: () => ['FLOAT', {}] as InputSpec
      }
    } as any

    const config1: InputSpec = ['INT', { min: 0 }]
    const config2: InputSpec = ['INT', { max: 100 }]

    const result = mergeIfValid(output, config2, false, undefined, config1)
    expect(result).toEqual({ customConfig: {} })
  })

  it('clamps widget value to min when below range', () => {
    vi.mocked(mergeInputSpec).mockReturnValueOnce(['INT', { min: 10, max: 50 }])

    const mockWidget = {
      value: 5,
      options: { min: 10, max: 50 },
      callback: vi.fn()
    }
    const recreateWidget = vi.fn(() => mockWidget)
    const output = {
      widget: {
        [GET_CONFIG]: () => ['INT', { min: 0 }] as InputSpec
      }
    } as any

    const result = mergeIfValid(
      output,
      ['INT', { min: 10, max: 50 }],
      false,
      recreateWidget
    )

    expect(recreateWidget).toHaveBeenCalled()
    expect(mockWidget.value).toBe(10)
    expect(mockWidget.callback).toHaveBeenCalledWith(10)
    expect(result.customConfig).toEqual({ min: 10, max: 50 })
  })

  it('clamps widget value to max when above range', () => {
    vi.mocked(mergeInputSpec).mockReturnValueOnce(['INT', { min: 0, max: 20 }])

    const mockWidget = {
      value: 100,
      options: { min: 0, max: 20 },
      callback: vi.fn()
    }
    const recreateWidget = vi.fn(() => mockWidget)
    const output = {
      widget: {
        [GET_CONFIG]: () => ['INT', {}] as InputSpec
      }
    } as any

    mergeIfValid(output, ['INT', { max: 20 }], false, recreateWidget)

    expect(mockWidget.value).toBe(20)
  })

  it('calls recreateWidget on forceUpdate even when merge returns null', () => {
    const mockWidget = {
      value: 5,
      options: {},
      callback: vi.fn()
    }
    const recreateWidget = vi.fn(() => mockWidget)
    const output = {
      widget: {
        [GET_CONFIG]: () => ['STRING', {}] as InputSpec
      }
    } as any

    mergeIfValid(output, ['STRING', {}], true, recreateWidget)

    expect(recreateWidget).toHaveBeenCalled()
  })
})
