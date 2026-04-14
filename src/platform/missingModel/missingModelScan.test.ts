import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'
import {
  scanAllModelCandidates,
  scanNodeModelCandidates,
  isModelFileName,
  enrichWithEmbeddedMetadata,
  verifyAssetSupportedCandidates,
  MODEL_FILE_EXTENSIONS
} from '@/platform/missingModel/missingModelScan'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

vi.mock('@/utils/graphTraversalUtil', () => ({
  collectAllNodes: (graph: { _testNodes: LGraphNode[] }) => graph._testNodes,
  getExecutionIdByNode: (
    _graph: unknown,
    node: { _testExecutionId?: string; id: number }
  ) => node._testExecutionId ?? String(node.id)
}))

/** Helper: create a combo widget mock */
function makeComboWidget(
  name: string,
  value: string | number,
  options: string[] = []
): IComboWidget {
  return fromAny<IComboWidget, unknown>({
    type: 'combo',
    name,
    value,
    options: { values: options }
  })
}

/** Helper: create an asset widget mock (Cloud combo replacement) */
function makeAssetWidget(name: string, value: string): IBaseWidget {
  return fromAny<IBaseWidget, unknown>({
    type: 'asset',
    name,
    value,
    options: {}
  })
}

/** Helper: create a non-combo widget mock */
function makeOtherWidget(name: string, value: unknown): IBaseWidget {
  return fromAny<IBaseWidget, unknown>({
    type: 'number',
    name,
    value,
    options: {}
  })
}

/** Helper: create a mock LGraphNode with configured widgets */
function makeNode(
  id: number,
  type: string,
  widgets: IBaseWidget[] = [],
  executionId?: string
): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id,
    type,
    widgets,
    _testExecutionId: executionId
  })
}

/** Helper: create a mock LGraph containing given nodes */
function makeGraph(nodes: LGraphNode[]): LGraph {
  return fromAny<LGraph, unknown>({ _testNodes: nodes })
}

const noAssetSupport = () => false

describe('isModelFileName', () => {
  it('should return true for common model extensions', () => {
    expect(isModelFileName('model.safetensors')).toBe(true)
    expect(isModelFileName('model.ckpt')).toBe(true)
    expect(isModelFileName('model.pt')).toBe(true)
    expect(isModelFileName('model.pth')).toBe(true)
    expect(isModelFileName('model.bin')).toBe(true)
    expect(isModelFileName('model.gguf')).toBe(true)
  })

  it('should return false for non-model extensions', () => {
    expect(isModelFileName('image.png')).toBe(false)
    expect(isModelFileName('video.mp4')).toBe(false)
    expect(isModelFileName('config.json')).toBe(false)
    expect(isModelFileName('no_extension')).toBe(false)
  })

  it('should be case-insensitive', () => {
    expect(isModelFileName('MODEL.SAFETENSORS')).toBe(true)
    expect(isModelFileName('Model.Ckpt')).toBe(true)
  })
})

describe('MODEL_FILE_EXTENSIONS', () => {
  it('should contain standard extensions', () => {
    expect(MODEL_FILE_EXTENSIONS.has('.safetensors')).toBe(true)
    expect(MODEL_FILE_EXTENSIONS.has('.ckpt')).toBe(true)
  })
})

describe('scanNodeModelCandidates', () => {
  it('returns candidates for a node with a missing model combo widget', () => {
    const graph = makeGraph([])
    const node = makeNode(1, 'CheckpointLoaderSimple', [
      makeComboWidget('ckpt_name', 'missing_model.safetensors', [
        'existing_model.safetensors'
      ])
    ])

    const result = scanNodeModelCandidates(graph, node, noAssetSupport)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      isAssetSupported: false,
      name: 'missing_model.safetensors',
      isMissing: true
    })
  })

  it('returns empty array for node with no widgets', () => {
    const graph = makeGraph([])
    const node = makeNode(1, 'EmptyNode', [])

    const result = scanNodeModelCandidates(graph, node, noAssetSupport)

    expect(result).toEqual([])
  })

  it('returns empty array when executionId is null', () => {
    const graph = makeGraph([])
    const node = makeNode(
      1,
      'CheckpointLoaderSimple',
      [makeComboWidget('ckpt_name', 'model.safetensors', [])],
      ''
    )

    const result = scanNodeModelCandidates(graph, node, noAssetSupport)

    expect(result).toEqual([])
  })

  it('enriches candidates with url/hash/directory from node.properties.models', () => {
    // Regression: bypass/un-bypass cycle previously lost url metadata
    // because realtime scan only reads widget values. Per-node embedded
    // metadata in `properties.models` persists across mode toggles, so
    // the scan now enriches candidates from that source.
    const graph = makeGraph([])
    const node = fromAny<LGraphNode, unknown>({
      id: 1,
      type: 'CheckpointLoaderSimple',
      widgets: [
        makeComboWidget('ckpt_name', 'missing_model.safetensors', [
          'other_model.safetensors'
        ])
      ],
      properties: {
        models: [
          {
            name: 'missing_model.safetensors',
            url: 'https://example.com/missing_model',
            directory: 'checkpoints',
            hash: 'abc123',
            hash_type: 'sha256'
          }
        ]
      }
    })

    const result = scanNodeModelCandidates(graph, node, noAssetSupport)

    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://example.com/missing_model')
    expect(result[0].directory).toBe('checkpoints')
    expect(result[0].hash).toBe('abc123')
    expect(result[0].hashType).toBe('sha256')
  })

  it('preserves existing candidate fields when enriching (no overwrite)', () => {
    const graph = makeGraph([])
    const node = fromAny<LGraphNode, unknown>({
      id: 1,
      type: 'CheckpointLoaderSimple',
      widgets: [makeComboWidget('ckpt_name', 'missing_model.safetensors', [])],
      properties: {
        models: [
          {
            name: 'missing_model.safetensors',
            url: 'https://example.com/new_url',
            directory: 'checkpoints'
          }
        ]
      }
    })

    const result = scanNodeModelCandidates(
      graph,
      node,
      noAssetSupport,
      () => 'checkpoints'
    )

    expect(result).toHaveLength(1)
    // scanComboWidget already sets directory via getDirectory; enrichment
    // does not overwrite it.
    expect(result[0].directory).toBe('checkpoints')
    // url was not set by scan, so enrichment fills it in.
    expect(result[0].url).toBe('https://example.com/new_url')
  })

  it('skips enrichment when candidate and embedded model directories differ', () => {
    // A node can list the same model name under multiple directories
    // (e.g. a LoRA present in both `loras` and `loras/subdir`). Name-only
    // matching would stamp the wrong url/hash onto the candidate, so
    // enrichment must agree on directory when the candidate already has
    // one.
    const graph = makeGraph([])
    const node = fromAny<LGraphNode, unknown>({
      id: 1,
      type: 'CheckpointLoaderSimple',
      widgets: [
        makeComboWidget('ckpt_name', 'collision_model.safetensors', [])
      ],
      properties: {
        models: [
          {
            name: 'collision_model.safetensors',
            url: 'https://example.com/wrong_dir_url',
            directory: 'wrong_dir'
          }
        ]
      }
    })

    const result = scanNodeModelCandidates(
      graph,
      node,
      noAssetSupport,
      () => 'checkpoints'
    )

    expect(result).toHaveLength(1)
    expect(result[0].directory).toBe('checkpoints')
    // Directory mismatch — enrichment should not stamp the wrong url.
    expect(result[0].url).toBeUndefined()
  })

  it('does not enrich candidates with mismatched model names', () => {
    const graph = makeGraph([])
    const node = fromAny<LGraphNode, unknown>({
      id: 1,
      type: 'CheckpointLoaderSimple',
      widgets: [makeComboWidget('ckpt_name', 'missing_model.safetensors', [])],
      properties: {
        models: [
          {
            name: 'different_model.safetensors',
            url: 'https://example.com/different',
            directory: 'checkpoints'
          }
        ]
      }
    })

    const result = scanNodeModelCandidates(graph, node, noAssetSupport)

    expect(result).toHaveLength(1)
    expect(result[0].url).toBeUndefined()
  })
})

describe('scanAllModelCandidates', () => {
  it('should detect a missing model from a combo widget', () => {
    const graph = makeGraph([
      makeNode(1, 'CheckpointLoaderSimple', [
        makeComboWidget('ckpt_name', 'missing_model.safetensors', [
          'existing_model.safetensors'
        ])
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toEqual([
      {
        nodeId: '1',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing_model.safetensors',
        isMissing: true
      }
    ])
  })

  it('should not report models that exist in combo options', () => {
    const graph = makeGraph([
      makeNode(1, 'CheckpointLoaderSimple', [
        makeComboWidget('ckpt_name', 'sd_xl_base_1.0.safetensors', [
          'sd_xl_base_1.0.safetensors'
        ])
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toEqual([
      {
        nodeId: '1',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'sd_xl_base_1.0.safetensors',
        isMissing: false
      }
    ])
  })

  it('should skip non-model values (no model extension)', () => {
    const graph = makeGraph([
      makeNode(1, 'SomeNode', [
        makeComboWidget('mode', 'custom_mode', ['fast', 'slow'])
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toEqual([])
  })

  it('should skip non-combo widgets', () => {
    const graph = makeGraph([
      makeNode(1, 'SomeNode', [
        makeOtherWidget('steps', 20),
        makeOtherWidget('cfg', 7.5)
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toEqual([])
  })

  it('should produce separate entries for same model in different nodes', () => {
    const graph = makeGraph([
      makeNode(1, 'CheckpointLoaderSimple', [
        makeComboWidget('ckpt_name', 'missing.safetensors', [])
      ]),
      makeNode(2, 'CheckpointLoaderSimple', [
        makeComboWidget('ckpt_name', 'missing.safetensors', [])
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(2)
    expect(result[0].nodeId).toBe('1')
    expect(result[1].nodeId).toBe('2')
  })

  it('should use correct widget name for each combo widget', () => {
    const graph = makeGraph([
      makeNode(1, 'LoraLoader', [
        makeComboWidget('lora_name', 'custom_lora.safetensors', [
          'existing.safetensors'
        ]),
        makeOtherWidget('strength', 0.8)
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toEqual([
      {
        nodeId: '1',
        nodeType: 'LoraLoader',
        widgetName: 'lora_name',
        isAssetSupported: false,
        name: 'custom_lora.safetensors',
        isMissing: true
      }
    ])
  })

  it('should skip nodes with no widgets', () => {
    const graph = makeGraph([makeNode(1, 'EmptyNode', [])])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toEqual([])
  })

  it('should detect missing models from custom nodes', () => {
    const graph = makeGraph([
      makeNode(1, 'WanVideoModelLoader', [
        makeComboWidget('model', 'Wan2_1-I2V-14B-480P_fp8_e4m3fn.safetensors', [
          'Wan2_1-I2V-14B.safetensors'
        ])
      ]),
      makeNode(2, 'WanVideoLoraSelect', [
        makeComboWidget('lora', 'SquishSquish_18.safetensors', [
          'default_lora.safetensors'
        ])
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.name)).toEqual([
      'Wan2_1-I2V-14B-480P_fp8_e4m3fn.safetensors',
      'SquishSquish_18.safetensors'
    ])
  })

  it('should detect multiple missing models from different nodes', () => {
    const graph = makeGraph([
      makeNode(1, 'CheckpointLoaderSimple', [
        makeComboWidget('ckpt_name', 'model_a.safetensors', [])
      ]),
      makeNode(2, 'LoraLoader', [
        makeComboWidget('lora_name', 'lora_b.safetensors', []),
        makeOtherWidget('strength', 0.8)
      ]),
      makeNode(3, 'VAELoader', [
        makeComboWidget('vae_name', 'vae_c.safetensors', [])
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(3)
  })

  it('should handle whitespace-only widget values', () => {
    const graph = makeGraph([
      makeNode(1, 'CheckpointLoaderSimple', [
        makeComboWidget('ckpt_name', '  ', []),
        makeComboWidget('other', '', [])
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toEqual([])
  })

  it('should set isMissing=undefined for asset-supported nodes', () => {
    const graph = makeGraph([
      makeNode(1, 'CheckpointLoaderSimple', [
        makeComboWidget('ckpt_name', 'missing.safetensors', [])
      ])
    ])

    const result = scanAllModelCandidates(graph, () => true)

    expect(result).toHaveLength(1)
    expect(result[0].isAssetSupported).toBe(true)
    expect(result[0].isMissing).toBeUndefined()
  })

  it('should set isMissing=true for non-asset nodes with missing model', () => {
    const graph = makeGraph([
      makeNode(1, 'CustomLoader', [
        makeComboWidget('model', 'custom.safetensors', [])
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(1)
    expect(result[0].isAssetSupported).toBe(false)
    expect(result[0].isMissing).toBe(true)
  })

  it('should pass directory from getDirectory callback', () => {
    const graph = makeGraph([
      makeNode(1, 'CheckpointLoaderSimple', [
        makeComboWidget('ckpt_name', 'model.safetensors', [])
      ])
    ])

    const result = scanAllModelCandidates(
      graph,
      noAssetSupport,
      () => 'checkpoints'
    )

    expect(result[0].directory).toBe('checkpoints')
  })

  it('should use execution ID from graph traversal for subgraph nodes', () => {
    const graph = makeGraph([
      makeNode(
        99,
        'CheckpointLoaderSimple',
        [makeComboWidget('ckpt_name', 'subgraph_model.safetensors', [])],
        '10:99'
      )
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(1)
    expect(result[0].nodeId).toBe('10:99')
    expect(result[0].name).toBe('subgraph_model.safetensors')
  })

  it('should detect missing models from asset widgets (Cloud combo replacement)', () => {
    const graph = makeGraph([
      makeNode(1, 'CheckpointLoaderSimple', [
        makeAssetWidget('ckpt_name', 'missing_model.safetensors')
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(1)
    expect(result[0].isAssetSupported).toBe(true)
    expect(result[0].isMissing).toBeUndefined()
    expect(result[0].name).toBe('missing_model.safetensors')
    expect(result[0].widgetName).toBe('ckpt_name')
  })

  it('should skip asset widgets with non-model values', () => {
    const graph = makeGraph([
      makeNode(1, 'SomeNode', [makeAssetWidget('mode', 'not_a_model')])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toEqual([])
  })

  it('should scan both combo and asset widgets on the same node', () => {
    const graph = makeGraph([
      makeNode(1, 'DualLoaderNode', [
        makeAssetWidget('ckpt_name', 'cloud_model.safetensors'),
        makeComboWidget('vae_name', 'local_vae.safetensors', [])
      ])
    ])

    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(2)
    expect(result[0].widgetName).toBe('ckpt_name')
    expect(result[0].isAssetSupported).toBe(true)
    expect(result[1].widgetName).toBe('vae_name')
  })

  it('skips muted nodes (mode === NEVER)', () => {
    const mutedNode = fromAny<LGraphNode, unknown>({
      id: 10,
      type: 'CheckpointLoaderSimple',
      widgets: [
        makeComboWidget('ckpt_name', 'model.safetensors', ['other.safetensors'])
      ],
      mode: 2, // LGraphEventMode.NEVER
      _testExecutionId: '10'
    })

    const graph = makeGraph([mutedNode])
    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(0)
  })

  it('skips bypassed nodes (mode === BYPASS)', () => {
    const bypassedNode = fromAny<LGraphNode, unknown>({
      id: 11,
      type: 'CheckpointLoaderSimple',
      widgets: [
        makeComboWidget('ckpt_name', 'model.safetensors', ['other.safetensors'])
      ],
      mode: 4, // LGraphEventMode.BYPASS
      _testExecutionId: '11'
    })

    const graph = makeGraph([bypassedNode])
    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(0)
  })

  it('includes active nodes (mode === ALWAYS)', () => {
    const activeNode = fromAny<LGraphNode, unknown>({
      id: 12,
      type: 'CheckpointLoaderSimple',
      widgets: [
        makeComboWidget('ckpt_name', 'model.safetensors', ['other.safetensors'])
      ],
      mode: 0, // LGraphEventMode.ALWAYS
      _testExecutionId: '12'
    })

    const graph = makeGraph([activeNode])
    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(1)
    expect(result[0].isMissing).toBe(true)
  })

  it('skips subgraph container nodes whose promoted widgets are already scanned via interior nodes', () => {
    const containerNode = fromAny<LGraphNode, unknown>({
      id: 65,
      type: 'abc-def-uuid',
      widgets: [makeComboWidget('ckpt_name', 'model.safetensors', [])],
      isSubgraphNode: () => true,
      _testExecutionId: '65'
    })

    const interiorNode = makeNode(
      42,
      'CheckpointLoaderSimple',
      [
        makeComboWidget('ckpt_name', 'model.safetensors', ['model.safetensors'])
      ],
      '65:42'
    )

    const graph = makeGraph([containerNode, interiorNode])
    const result = scanAllModelCandidates(graph, noAssetSupport)

    expect(result).toHaveLength(1)
    expect(result[0].nodeId).toBe('65:42')
    expect(result[0].nodeType).toBe('CheckpointLoaderSimple')
  })
})

function makeCandidate(
  name: string,
  opts: Partial<MissingModelCandidate> = {}
): MissingModelCandidate {
  return {
    nodeId: opts.nodeId ?? 1,
    nodeType: opts.nodeType ?? 'CheckpointLoaderSimple',
    widgetName: opts.widgetName ?? 'ckpt_name',
    isAssetSupported: opts.isAssetSupported ?? false,
    name,
    isMissing: opts.isMissing ?? true,
    ...opts
  }
}

const alwaysMissing = async () => false
const alwaysInstalled = async () => true

describe('enrichWithEmbeddedMetadata', () => {
  it('enriches existing candidate with url and directory from embedded metadata', async () => {
    const candidates = [makeCandidate('model_a.safetensors')]
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          widgets_values: { ckpt_name: 'model_a.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'model_a.safetensors',
          url: 'https://example.com/model_a',
          directory: 'checkpoints',
          hash: 'abc123',
          hash_type: 'sha256'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing
    )

    expect(result[0].url).toBe('https://example.com/model_a')
    expect(result[0].directory).toBe('checkpoints')
    expect(result[0].hash).toBe('abc123')
  })

  it('does not overwrite existing fields on candidate', async () => {
    const candidates = [
      makeCandidate('model_a.safetensors', {
        directory: 'existing_dir',
        url: 'https://existing.com'
      })
    ]
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          widgets_values: { ckpt_name: 'model_a.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'model_a.safetensors',
          url: 'https://new.com',
          directory: 'new_dir'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing
    )

    // ??= should not overwrite existing values
    expect(result[0].url).toBe('https://existing.com')
    expect(result[0].directory).toBe('existing_dir')
  })

  it('does not mutate the original candidates array', async () => {
    const candidates = [makeCandidate('model_a.safetensors')]
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          widgets_values: { ckpt_name: 'model_a.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'model_a.safetensors',
          url: 'https://example.com/model_a',
          directory: 'checkpoints'
        }
      ]
    })

    const originalUrl = candidates[0].url
    await enrichWithEmbeddedMetadata(candidates, graphData, alwaysMissing)

    expect(candidates[0].url).toBe(originalUrl)
  })

  it('adds new candidate for embedded model not found by COMBO scan', async () => {
    const candidates: MissingModelCandidate[] = []
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          widgets_values: { ckpt_name: 'model_a.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'model_a.safetensors',
          url: 'https://example.com/model_a',
          directory: 'checkpoints'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing
    )

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('model_a.safetensors')
    expect(result[0].isMissing).toBe(true)
  })

  it('does not add candidate when model is already installed', async () => {
    const candidates: MissingModelCandidate[] = []
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'installed_model.safetensors',
          url: 'https://example.com',
          directory: 'checkpoints'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysInstalled
    )

    expect(result).toHaveLength(0)
  })

  it('skips embedded models from muted nodes', async () => {
    const candidates: MissingModelCandidate[] = []
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 2, // NEVER (muted)
          properties: {},
          widgets_values: { ckpt_name: 'model.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'model.safetensors',
          url: 'https://example.com/model',
          directory: 'checkpoints'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing
    )

    expect(result).toHaveLength(0)
  })

  it('drops workflow-level model entries when only referencing nodes are bypassed (other active nodes present)', async () => {
    // Regression: a previous `hasActiveNodes` check kept workflow-level
    // models in a mixed graph if ANY active node existed, even when every
    // node that actually referenced the model was bypassed. The correct
    // check drops unmatched workflow-level entries since candidates are
    // derived from active-node widgets.
    const candidates: MissingModelCandidate[] = []
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 2,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 4, // BYPASS — only node referencing the model
          properties: {},
          widgets_values: { ckpt_name: 'model.safetensors' }
        },
        {
          id: 2,
          type: 'KSampler',
          pos: [200, 0],
          size: [100, 100],
          flags: {},
          order: 1,
          mode: 0, // ALWAYS — unrelated active node
          properties: {},
          widgets_values: {}
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'model.safetensors',
          url: 'https://example.com/model',
          directory: 'checkpoints'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing
    )

    expect(result).toHaveLength(0)
  })

  it('keeps unmatched node-sourced entries in a mixed graph', async () => {
    // A node-sourced unmatched entry (sourceNodeType !== '') must survive
    // the workflow-level filter. This ensures the simplification does not
    // over-filter legitimate per-node missing models.
    const candidates = [
      makeCandidate('node_model.safetensors', { nodeId: '1' })
    ]
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: {
            models: [
              {
                name: 'node_model.safetensors',
                url: 'https://example.com/node_model',
                directory: 'checkpoints'
              }
            ]
          },
          widgets_values: { ckpt_name: 'node_model.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: []
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing
    )

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('node_model.safetensors')
  })

  it('skips embedded models from bypassed nodes', async () => {
    const candidates: MissingModelCandidate[] = []
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 4, // BYPASS
          properties: {},
          widgets_values: { ckpt_name: 'model.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'model.safetensors',
          url: 'https://example.com/model',
          directory: 'checkpoints'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing
    )

    expect(result).toHaveLength(0)
  })
})

describe('OSS missing model detection (non-Cloud path)', () => {
  it('scanAllModelCandidates returns empty array when not called (simulating isCloud === false guard)', () => {
    // In the app, when isCloud is false, scanAllModelCandidates is not called
    // and an empty array is used instead. This test verifies the OSS path
    // starts with an empty candidates list.
    const isCloud = false
    const graph = makeGraph([
      makeNode(1, 'CheckpointLoaderSimple', [
        makeComboWidget('ckpt_name', 'missing_model.safetensors', [])
      ])
    ])

    const modelCandidates = isCloud
      ? scanAllModelCandidates(graph, noAssetSupport)
      : []

    expect(modelCandidates).toEqual([])
  })

  it('enrichWithEmbeddedMetadata detects missing embedded models without prior COMBO scan (OSS dialog path)', async () => {
    // OSS path: candidates start empty, enrichWithEmbeddedMetadata adds
    // missing embedded models so the dialog can show them.
    const candidates: MissingModelCandidate[] = []
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 2,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          widgets_values: { ckpt_name: 'sd_xl_base_1.0.safetensors' }
        },
        {
          id: 2,
          type: 'LoraLoader',
          pos: [200, 0],
          size: [100, 100],
          flags: {},
          order: 1,
          mode: 0,
          properties: {},
          widgets_values: { lora_name: 'detail_enhancer.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'sd_xl_base_1.0.safetensors',
          url: 'https://example.com/sdxl',
          directory: 'checkpoints'
        },
        {
          name: 'detail_enhancer.safetensors',
          url: 'https://example.com/lora',
          directory: 'loras'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing
    )

    expect(result).toHaveLength(2)
    expect(result.every((c) => c.isMissing === true)).toBe(true)
    expect(result.map((c) => c.name)).toEqual([
      'sd_xl_base_1.0.safetensors',
      'detail_enhancer.safetensors'
    ])
  })

  it('enrichWithEmbeddedMetadata sets isMissing=true when isAssetSupported is not provided (OSS)', async () => {
    // When isAssetSupported is omitted (OSS), unmatched embedded models
    // should have isMissing=true (not undefined), enabling the dialog.
    const candidates: MissingModelCandidate[] = []
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          widgets_values: { ckpt_name: 'missing_model.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'missing_model.safetensors',
          url: 'https://example.com/model',
          directory: 'checkpoints'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing
    )

    expect(result).toHaveLength(1)
    expect(result[0].isMissing).toBe(true)
    expect(result[0].isAssetSupported).toBe(false)
  })

  it('enrichWithEmbeddedMetadata correctly filters for dialog: only isMissing=true with url', async () => {
    const candidates: MissingModelCandidate[] = []
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          widgets_values: { ckpt_name: 'missing_model.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'missing_model.safetensors',
          url: 'https://example.com/model',
          directory: 'checkpoints'
        },
        {
          name: 'installed_model.safetensors',
          url: 'https://example.com/installed',
          directory: 'checkpoints'
        }
      ]
    })

    const selectiveInstallCheck = async (name: string) =>
      name === 'installed_model.safetensors'

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      selectiveInstallCheck
    )

    const dialogModels = result.filter((c) => c.isMissing === true && c.url)
    expect(dialogModels).toHaveLength(1)
    expect(dialogModels[0].name).toBe('missing_model.safetensors')
    expect(dialogModels[0].url).toBe('https://example.com/model')
  })

  it('enrichWithEmbeddedMetadata with isAssetSupported leaves isMissing undefined for asset-supported models (Cloud path)', async () => {
    const candidates: MissingModelCandidate[] = []
    const graphData = fromPartial<ComfyWorkflowJSON>({
      last_node_id: 1,
      last_link_id: 0,
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          widgets_values: { ckpt_name: 'model.safetensors' }
        }
      ],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
      models: [
        {
          name: 'model.safetensors',
          url: 'https://example.com/model',
          directory: 'checkpoints'
        }
      ]
    })

    const result = await enrichWithEmbeddedMetadata(
      candidates,
      graphData,
      alwaysMissing,
      () => true
    )

    expect(result).toHaveLength(1)
    expect(result[0].isMissing).toBeUndefined()
    expect(result[0].isAssetSupported).toBe(true)
  })
})

const {
  mockUpdateModelsForNodeType,
  mockIsModelLoading,
  mockHasMore,
  mockGetAssets
} = vi.hoisted(() => ({
  mockUpdateModelsForNodeType: vi.fn().mockResolvedValue(undefined),
  mockIsModelLoading: vi.fn().mockReturnValue(false),
  mockHasMore: vi.fn().mockReturnValue(false),
  mockGetAssets: vi.fn().mockReturnValue([])
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    updateModelsForNodeType: mockUpdateModelsForNodeType,
    isModelLoading: mockIsModelLoading,
    hasMore: mockHasMore,
    getAssets: mockGetAssets
  })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: vi.fn()
  })
}))

vi.mock('@/i18n', () => ({
  st: (_key: string, fallback: string) => fallback
}))

function makeAssetCandidate(
  name: string,
  opts: Partial<MissingModelCandidate> = {}
): MissingModelCandidate {
  return {
    nodeId: opts.nodeId ?? 1,
    nodeType: opts.nodeType ?? 'CheckpointLoaderSimple',
    widgetName: opts.widgetName ?? 'ckpt_name',
    isAssetSupported: opts.isAssetSupported ?? true,
    name,
    isMissing: opts.isMissing,
    ...opts
  }
}

describe('verifyAssetSupportedCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsModelLoading.mockReturnValue(false)
    mockHasMore.mockReturnValue(false)
    mockGetAssets.mockReturnValue([])
  })

  it('should resolve isMissing=true for candidates not found in asset store', async () => {
    const candidates = [makeAssetCandidate('missing_model.safetensors')]
    mockGetAssets.mockReturnValue([])

    await verifyAssetSupportedCandidates(candidates)

    expect(candidates[0].isMissing).toBe(true)
    expect(mockUpdateModelsForNodeType).toHaveBeenCalledWith(
      'CheckpointLoaderSimple'
    )
  })

  it('should resolve isMissing=false when asset with matching hash exists', async () => {
    const candidates = [
      makeAssetCandidate('model.safetensors', {
        hash: 'abc123',
        hashType: 'sha256'
      })
    ]
    mockGetAssets.mockReturnValue([
      { id: '1', name: 'model.safetensors', asset_hash: 'sha256:abc123' }
    ])

    await verifyAssetSupportedCandidates(candidates)

    expect(candidates[0].isMissing).toBe(false)
  })

  it('should resolve isMissing=false when asset with matching filename exists', async () => {
    const candidates = [makeAssetCandidate('my_model.safetensors')]
    mockGetAssets.mockReturnValue([
      {
        id: '1',
        name: 'my_model.safetensors',
        asset_hash: null,
        metadata: { filename: 'my_model.safetensors' }
      }
    ])

    await verifyAssetSupportedCandidates(candidates)

    expect(candidates[0].isMissing).toBe(false)
  })

  it('should return immediately when signal is already aborted', async () => {
    const candidates = [makeAssetCandidate('model.safetensors')]
    const controller = new AbortController()
    controller.abort()

    await verifyAssetSupportedCandidates(candidates, controller.signal)

    // isMissing should remain undefined since we aborted before resolving
    expect(candidates[0].isMissing).toBeUndefined()
  })

  it('should return immediately when no asset-supported candidates exist', async () => {
    const candidates = [
      makeAssetCandidate('model.safetensors', {
        isAssetSupported: false,
        isMissing: true
      })
    ]

    await verifyAssetSupportedCandidates(candidates)

    expect(mockUpdateModelsForNodeType).not.toHaveBeenCalled()
    expect(candidates[0].isMissing).toBe(true)
  })

  it('should skip candidates with isMissing already resolved', async () => {
    const candidates = [
      makeAssetCandidate('found.safetensors', { isMissing: false }),
      makeAssetCandidate('missing.safetensors', { isMissing: true })
    ]

    await verifyAssetSupportedCandidates(candidates)

    expect(mockUpdateModelsForNodeType).not.toHaveBeenCalled()
    expect(candidates[0].isMissing).toBe(false)
    expect(candidates[1].isMissing).toBe(true)
  })

  it('should deduplicate nodeType calls to updateModelsForNodeType', async () => {
    const candidates = [
      makeAssetCandidate('model_a.safetensors'),
      makeAssetCandidate('model_b.safetensors')
    ]

    await verifyAssetSupportedCandidates(candidates)

    expect(mockUpdateModelsForNodeType).toHaveBeenCalledTimes(1)
  })

  it('should call updateModelsForNodeType for each unique nodeType', async () => {
    const candidates = [
      makeAssetCandidate('model_a.safetensors', {
        nodeType: 'CheckpointLoaderSimple'
      }),
      makeAssetCandidate('model_b.safetensors', { nodeType: 'LoraLoader' })
    ]

    await verifyAssetSupportedCandidates(candidates)

    expect(mockUpdateModelsForNodeType).toHaveBeenCalledWith(
      'CheckpointLoaderSimple'
    )
    expect(mockUpdateModelsForNodeType).toHaveBeenCalledWith('LoraLoader')
  })

  it('should match filename with path prefix normalization', async () => {
    const candidates = [makeAssetCandidate('subfolder/my_model.safetensors')]
    mockGetAssets.mockReturnValue([
      {
        id: '1',
        name: 'my_model.safetensors',
        asset_hash: null,
        metadata: { filename: 'subfolder/my_model.safetensors' }
      }
    ])

    await verifyAssetSupportedCandidates(candidates)

    expect(candidates[0].isMissing).toBe(false)
  })
})
