import type { NodeReplacementResponse } from './types'

import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { LGraph, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { fetchNodeReplacements } from './nodeReplacementService'
import { useNodeReplacementStore } from './nodeReplacementStore'

vi.mock(import('./nodeReplacementService'), () => ({
  fetchNodeReplacements: vi.fn()
}))

vi.mock(import('@/scripts/api'))

function createStore(settingEnabled = true, serverFeatureEnabled = true) {
  useSettingStore().settingValues['Comfy.NodeReplacement.Enabled'] =
    settingEnabled
  vi.mocked(useSettingStore().load).mockResolvedValue(undefined)
  vi.mocked(api.getServerFeature).mockImplementation(
    (flag: string, defaultValue?: unknown) => {
      if (flag === ServerFeatureFlag.NODE_REPLACEMENTS) {
        return serverFeatureEnabled
      }
      return defaultValue
    }
  )
  return useNodeReplacementStore()
}

function installBooleanFixture(source: string, target: string) {
  const booleanDef = (name: string, python_module: string) =>
    new ComfyNodeDefImpl({
      name,
      display_name: name,
      description: '',
      category: 'utils',
      python_module,
      input: {},
      output: ['BOOLEAN'],
      output_is_list: [false],
      output_name: ['BOOLEAN'],
      output_node: false
    })
  class SourceNode extends LGraphNode {
    static override nodeData = booleanDef('BooleanBasic', source)

    constructor() {
      super('BooleanBasic')
      this.serialize_widgets = true
      this.addOutput('BOOLEAN', 'BOOLEAN')
      this.addWidget('toggle', 'boolean', false, () => {})
    }
  }
  class TargetNode extends LGraphNode {
    static override nodeData = booleanDef('PrimitiveBoolean', target)
  }
  LiteGraph.registerNodeType('BooleanBasic', SourceNode)
  LiteGraph.registerNodeType('PrimitiveBoolean', TargetNode)
  const node = LiteGraph.createNode('BooleanBasic')
  assert.exists(node)
  new LGraph().add(node)
  node.properties.cnr_id = 'controlaltai-nodes'
  return node
}

describe('useNodeReplacementStore', () => {
  let store: ReturnType<typeof useNodeReplacementStore>

  beforeEach(() => {
    store = createStore()
  })

  it('should initialize with empty replacements', () => {
    expect(store.replacements).toEqual({})
    expect(store.isLoaded).toBe(false)
  })

  it.for([
    [
      'custom_nodes.ControlAltAI-Nodes@1.0.0',
      'comfy_extras.nodes_primitive',
      true
    ],
    ['custom_nodes.lookalike', 'comfy_extras.nodes_primitive', false],
    ['custom_nodes.ControlAltAI-Nodes', 'custom_nodes.lookalike', false]
  ] as const)(
    'offers installed swaps only for the expected live modules (%s, %s)',
    ([source, target, eligible]) => {
      const node = installBooleanFixture(source, target)
      expect(store.getInstalledNodeReplacement(node)?.new_node_id).toBe(
        eligible ? 'PrimitiveBoolean' : undefined
      )
    }
  )

  it('omits the replacement and reports a custom serializer failure', () => {
    const node = installBooleanFixture(
      'custom_nodes.ControlAltAI-Nodes',
      'comfy_extras.nodes_primitive'
    )
    const error = new Error('Custom node serialization failed')
    node.onSerialize = () => {
      throw error
    }

    expect(store.getInstalledNodeReplacement(node)).toBeNull()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      surface: 'graph',
      errorType: 'failure_serializing_installed_node_for_replacement'
    })
  })

  it('offers a known missing-node rule without a server feature, but not for another pack', () => {
    const store = createStore(true, false)
    const node = {
      type: 'BooleanBasic',
      properties: { cnr_id: 'controlaltai-nodes' },
      outputs: [{ type: 'BOOLEAN' }],
      widgets_values_named: { boolean: false },
      widgets_values: [true]
    }
    expect(store.getMissingNodeReplacement(node)).toBeNull()
    LiteGraph.registerNodeType('PrimitiveBoolean', class extends LGraphNode {})
    try {
      expect(store.getMissingNodeReplacement(node)).toMatchObject({
        new_node_id: 'PrimitiveBoolean',
        input_mapping: [{ old_id: 'boolean', new_id: 'value' }]
      })
      expect(
        store.getMissingNodeReplacement({
          ...node,
          properties: { cnr_id: 'other-pack' }
        })
      ).toBeNull()
      expect(
        store.getMissingNodeReplacement({
          ...node,
          outputs: [...node.outputs, { type: 'STRING' }]
        })
      ).toBeNull()
      const server = {
        old_node_id: node.type,
        new_node_id: 'ServerBoolean',
        old_widget_ids: null,
        input_mapping: null,
        output_mapping: null
      }
      store.replacements = { [node.type]: [server] }
      expect(store.getMissingNodeReplacement(node)).toEqual(server)
    } finally {
      LiteGraph.unregisterNodeType('PrimitiveBoolean')
    }
  })

  describe('getReplacementFor', () => {
    it('should return first replacement for existing node type', () => {
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNodeA',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          },
          {
            new_node_id: 'NewNodeB',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      const result = store.getReplacementFor('OldNode')

      expect(result).not.toBeNull()
      expect(result?.new_node_id).toBe('NewNodeA')
    })

    it('should return null for non-existing node type', () => {
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNode',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      const result = store.getReplacementFor('NonExistentNode')

      expect(result).toBeNull()
    })

    it('should return null for empty replacement array', () => {
      store.replacements = {
        OldNode: []
      }

      const result = store.getReplacementFor('OldNode')

      expect(result).toBeNull()
    })

    it('should return null when feature is disabled', () => {
      store = createStore(false)
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNode',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      const result = store.getReplacementFor('OldNode')

      expect(result).toBeNull()
    })
  })

  describe('hasReplacement', () => {
    it('should return true when replacement exists', () => {
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNode',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      expect(store.hasReplacement('OldNode')).toBe(true)
    })

    it('should return false when node type does not exist', () => {
      store.replacements = {}

      expect(store.hasReplacement('NonExistentNode')).toBe(false)
    })

    it('should return false when replacement array is empty', () => {
      store.replacements = {
        OldNode: []
      }

      expect(store.hasReplacement('OldNode')).toBe(false)
    })

    it('should return false when feature is disabled', () => {
      store = createStore(false)
      store.replacements = {
        OldNode: [
          {
            new_node_id: 'NewNode',
            old_node_id: 'OldNode',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      expect(store.hasReplacement('OldNode')).toBe(false)
    })
  })

  describe('isEnabled', () => {
    it('should return true when setting is enabled', () => {
      expect(store.isEnabled).toBe(true)
    })

    it('should return false when setting is disabled', () => {
      store = createStore(false)
      expect(store.isEnabled).toBe(false)
    })
  })

  describe('load', () => {
    const mockReplacements: NodeReplacementResponse = {
      OldNode: [
        {
          new_node_id: 'NewNode',
          old_node_id: 'OldNode',
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        }
      ]
    }

    it('should fetch and assign replacements on successful load', async () => {
      vi.mocked(fetchNodeReplacements).mockResolvedValue(mockReplacements)
      store = createStore()

      await store.load()

      expect(fetchNodeReplacements).toHaveBeenCalledOnce()
      expect(store.replacements).toEqual(mockReplacements)
      expect(store.isLoaded).toBe(true)
    })

    it('should log error but not throw when fetch fails', async () => {
      const error = new Error('Network error')
      vi.mocked(fetchNodeReplacements).mockRejectedValue(error)
      store = createStore()

      await expect(store.load()).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith(
        'Failed to load node replacements:',
        error
      )
      expect(store.isLoaded).toBe(false)
    })

    it('should not fetch when setting is disabled', async () => {
      vi.mocked(fetchNodeReplacements).mockResolvedValue({})
      store = createStore(false)

      await store.load()

      expect(fetchNodeReplacements).not.toHaveBeenCalled()
      expect(store.isLoaded).toBe(false)
    })

    it('should not fetch when server feature flag is disabled', async () => {
      vi.mocked(fetchNodeReplacements).mockResolvedValue(mockReplacements)
      store = createStore(true, false)

      await store.load()

      expect(fetchNodeReplacements).not.toHaveBeenCalled()
      expect(store.isLoaded).toBe(false)
    })

    it('should not re-fetch when called twice', async () => {
      vi.mocked(fetchNodeReplacements).mockResolvedValue(mockReplacements)
      store = createStore()

      await store.load()
      await store.load()

      expect(fetchNodeReplacements).toHaveBeenCalledOnce()
    })
  })
})

vi.mock(import('@/scripts/app'))
