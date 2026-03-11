import { describe, expect, it, vi } from 'vitest'

import {
  scanAllModelCandidates,
  isModelFileName,
  enrichWithEmbeddedMetadata,
  MODEL_FILE_EXTENSIONS
} from '@/platform/missingModel/missingModelScan'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'

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
  return {
    type: 'combo',
    name,
    value,
    options: { values: options }
  } as unknown as IComboWidget
}

/** Helper: create an asset widget mock (Cloud combo replacement) */
function makeAssetWidget(name: string, value: string): IBaseWidget {
  return {
    type: 'asset',
    name,
    value,
    options: {}
  } as unknown as IBaseWidget
}

/** Helper: create a non-combo widget mock */
function makeOtherWidget(name: string, value: unknown): IBaseWidget {
  return {
    type: 'number',
    name,
    value,
    options: {}
  } as unknown as IBaseWidget
}

/** Helper: create a mock LGraphNode with configured widgets */
function makeNode(
  id: number,
  type: string,
  widgets: IBaseWidget[] = [],
  executionId?: string
): LGraphNode {
  return {
    id,
    type,
    widgets,
    _testExecutionId: executionId
  } as unknown as LGraphNode
}

/** Helper: create a mock LGraph containing given nodes */
function makeGraph(nodes: LGraphNode[]): LGraph {
  return { _testNodes: nodes } as unknown as LGraph
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
    const graphData = {
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
    } as unknown as ComfyWorkflowJSON

    await enrichWithEmbeddedMetadata(candidates, graphData, alwaysMissing)

    expect(candidates[0].url).toBe('https://example.com/model_a')
    expect(candidates[0].directory).toBe('checkpoints')
    expect(candidates[0].hash).toBe('abc123')
  })

  it('does not overwrite existing fields on candidate', async () => {
    const candidates = [
      makeCandidate('model_a.safetensors', {
        directory: 'existing_dir',
        url: 'https://existing.com'
      })
    ]
    const graphData = {
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
    } as unknown as ComfyWorkflowJSON

    await enrichWithEmbeddedMetadata(candidates, graphData, alwaysMissing)

    // ??= should not overwrite existing values
    expect(candidates[0].url).toBe('https://existing.com')
    expect(candidates[0].directory).toBe('existing_dir')
  })

  it('adds new candidate for embedded model not found by COMBO scan', async () => {
    const candidates: MissingModelCandidate[] = []
    const graphData = {
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
    } as unknown as ComfyWorkflowJSON

    await enrichWithEmbeddedMetadata(candidates, graphData, alwaysMissing)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].name).toBe('model_a.safetensors')
    expect(candidates[0].isMissing).toBe(true)
  })

  it('does not add candidate when model is already installed', async () => {
    const candidates: MissingModelCandidate[] = []
    const graphData = {
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
    } as unknown as ComfyWorkflowJSON

    await enrichWithEmbeddedMetadata(candidates, graphData, alwaysInstalled)

    expect(candidates).toHaveLength(0)
  })
})
