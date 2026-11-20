import type { NodeReplacement, NodeReplacementResponse } from './types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('useNodeReplacementStore', () => {
  let store: ReturnType<typeof useNodeReplacementStore>

  beforeEach(() => {
    store = createStore()
  })

  it('should initialize with empty replacements', () => {
    expect(store.replacements).toEqual({})
    expect(store.isLoaded).toBe(false)
  })

  describe('getReplacementForMissing', () => {
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

      const result = store.getReplacementForMissing('OldNode', undefined, {
        widgetsValues: []
      })

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

      const result = store.getReplacementForMissing(
        'NonExistentNode',
        undefined,
        { widgetsValues: [] }
      )

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

      const result = store.getReplacementForMissing('OldNode', undefined, {
        widgetsValues: []
      })

      expect(result).toBeNull()
    })

    it.for([
      {
        name: 'the entry for the saved pack',
        cnrId: 'pack-b',
        widgetValues: ['text'],
        expected: 'FromPackB'
      },
      {
        name: 'the entry for the saved pack written in another case',
        cnrId: 'Pack-B',
        widgetValues: ['text'],
        expected: 'FromPackB'
      },
      {
        name: 'nothing for a pack without an entry',
        cnrId: 'comfy-core',
        widgetValues: ['text'],
        expected: null
      },
      {
        name: 'nothing for a node without a pack when two packs have entries',
        cnrId: undefined,
        widgetValues: ['text'],
        expected: null
      }
    ])('selects $name', ({ cnrId, widgetValues, expected }) => {
      store.replacements = {
        StringConstant: [
          {
            new_node_id: 'FromPackA',
            old_node_id: 'StringConstant',
            old_widget_ids: ['string'],
            input_mapping: [{ new_id: 'value', old_id: 'string' }],
            output_mapping: null,
            old_pack: 'pack-a',
            kind: 'equivalent'
          },
          {
            new_node_id: 'FromPackB',
            old_node_id: 'StringConstant',
            old_widget_ids: ['string'],
            input_mapping: [{ new_id: 'value', old_id: 'string' }],
            output_mapping: null,
            old_pack: 'Pack-B',
            kind: 'equivalent'
          }
        ]
      }

      const result = store.getReplacementForMissing('StringConstant', cnrId, {
        widgetsValues: widgetValues
      })

      expect(result?.new_node_id ?? null).toBe(expected)
    })

    it.for([
      {
        name: 'matching widget count',
        oldWidgetIds: ['string'],
        widgetValues: ['text'],
        matches: true
      },
      {
        name: 'extra widget values',
        oldWidgetIds: ['string'],
        widgetValues: ['text', true],
        matches: false
      },
      {
        name: 'named widget values',
        oldWidgetIds: ['string'],
        widgetValues: { string: 'text' },
        matches: false
      },
      {
        name: 'no saved widget values for a widgetless entry',
        oldWidgetIds: null,
        widgetValues: undefined,
        matches: true
      },
      {
        name: 'no saved widget values for an entry with widgets',
        oldWidgetIds: ['string'],
        widgetValues: undefined,
        matches: false
      }
    ])(
      'applies the only pack entry to a node without a pack given $name: $matches',
      ({ oldWidgetIds, widgetValues, matches }) => {
        store.replacements = {
          StringConstant: [
            {
              new_node_id: 'PrimitiveString',
              old_node_id: 'StringConstant',
              old_widget_ids: oldWidgetIds,
              input_mapping: [{ new_id: 'value', old_id: 'string' }],
              output_mapping: null,
              old_pack: 'comfyui-kjnodes',
              kind: 'equivalent'
            }
          ]
        }

        const result = store.getReplacementForMissing(
          'StringConstant',
          undefined,
          { widgetsValues: widgetValues }
        )

        expect(result !== null).toBe(matches)
      }
    )

    it('applies the first entry to a node without a pack when every entry names one pack', () => {
      const fromKjNodes = (newNodeId: string): NodeReplacement => ({
        new_node_id: newNodeId,
        old_node_id: 'StringConstant',
        old_widget_ids: ['string'],
        input_mapping: [{ new_id: 'value', old_id: 'string' }],
        output_mapping: null,
        old_pack: 'comfyui-kjnodes',
        kind: 'equivalent'
      })
      store.replacements = {
        StringConstant: [
          fromKjNodes('PrimitiveString'),
          { ...fromKjNodes('Other'), old_pack: 'ComfyUI-KJNodes' }
        ]
      }

      const result = store.getReplacementForMissing(
        'StringConstant',
        undefined,
        { widgetsValues: ['text'] }
      )

      expect(result?.new_node_id).toBe('PrimitiveString')
    })

    it.for([
      {
        name: 'its widgets, one linked, without the control value',
        inputs: { seed: 5, text: ['2', 0], image: ['3', 0] },
        matches: true
      },
      {
        name: 'a widget the entry does not name',
        inputs: { seed: 5, text: 'x', denoise: 1 },
        matches: false
      },
      {
        name: 'a widget the entry names missing',
        inputs: { text: 'x' },
        matches: false
      }
    ])(
      'applies the only pack entry to an API node without a pack given $name: $matches',
      ({ inputs, matches }) => {
        store.replacements = {
          SeededText: [
            {
              new_node_id: 'CoreSeededText',
              old_node_id: 'SeededText',
              old_widget_ids: ['seed', 'control_after_generate', 'text'],
              input_mapping: null,
              output_mapping: null,
              old_pack: 'some-pack',
              kind: 'equivalent'
            }
          ]
        }

        const result = store.getReplacementForMissing('SeededText', undefined, {
          apiInputs: inputs
        })

        expect(result !== null).toBe(matches)
      }
    )
  })

  describe('getReplacementForInstalled', () => {
    it.for([
      {
        name: 'core',
        pythonModule: 'comfy_extras.nodes_primitive',
        expected: null
      },
      {
        name: 'another pack',
        pythonModule: 'custom_nodes.ComfyUI-Other',
        expected: null
      },
      {
        name: 'the entry pack, cloned under a mixed-case directory',
        pythonModule: 'custom_nodes.ComfyUI-Extended',
        expected: 'PrimitiveBooleanCore'
      },
      {
        name: 'the entry pack, installed from the registry with a version',
        pythonModule: 'custom_nodes.comfyui-extended@1_2_0',
        expected: 'PrimitiveBooleanCore'
      }
    ])(
      'applies a pack entry to a node defined by $name: $expected',
      ({ pythonModule, expected }) => {
        store.replacements = {
          PrimitiveBoolean: [
            {
              new_node_id: 'PrimitiveBooleanCore',
              old_node_id: 'PrimitiveBoolean',
              old_widget_ids: ['value'],
              input_mapping: [{ new_id: 'value', old_id: 'value' }],
              output_mapping: null,
              old_pack: 'comfyui-extended',
              kind: 'equivalent'
            }
          ]
        }

        const result = store.getReplacementForInstalled(
          'PrimitiveBoolean',
          pythonModule
        )

        expect(result?.new_node_id ?? null).toBe(expected)
      }
    )

    it('applies an entry without a pack to a core node', () => {
      store.replacements = {
        ImageBatch: [
          {
            new_node_id: 'BatchImagesNode',
            old_node_id: 'ImageBatch',
            old_widget_ids: null,
            input_mapping: null,
            output_mapping: null
          }
        ]
      }

      const result = store.getReplacementForInstalled('ImageBatch', 'nodes')

      expect(result?.new_node_id).toBe('BatchImagesNode')
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
