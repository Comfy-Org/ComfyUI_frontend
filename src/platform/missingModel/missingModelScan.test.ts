import { describe, expect, it } from 'vitest'

import {
  scanAllModelCandidates,
  isModelFileName,
  enrichWithEmbeddedMetadata,
  MODEL_FILE_EXTENSIONS
} from '@/platform/missingModel/missingModelScan'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type {
  ComfyNode,
  ComfyWorkflowJSON
} from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

/** Helper: wrap nodes in a minimal ComfyWorkflowJSON */
function makeGraphData(nodes: ComfyWorkflowJSON['nodes']): ComfyWorkflowJSON {
  return {
    last_node_id: nodes.length,
    last_link_id: 0,
    nodes,
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  } as unknown as ComfyWorkflowJSON
}

/** Helper: create a minimal node */
function makeNode(
  type: string,
  widgetsValues: unknown[] | Record<string, unknown> = [],
  id: number = 1
) {
  return {
    id,
    type,
    pos: [0, 0] as [number, number],
    size: [100, 100] as [number, number],
    flags: {},
    order: 0,
    mode: 0,
    properties: { 'Node name for S&R': type },
    widgets_values: widgetsValues
  }
}

/**
 * Helper: create a fake ComfyNodeDefImpl with COMBO inputs.
 * Uses V2 schema format: inputs is Record<string, InputSpecV2>.
 */
function makeNodeDef(
  name: string,
  comboInputs: Record<string, string[]>,
  otherInputs?: Record<string, { type: string }>
): ComfyNodeDefImpl {
  const inputs: Record<string, unknown> = {}

  for (const [inputName, options] of Object.entries(comboInputs)) {
    inputs[inputName] = {
      type: 'COMBO',
      name: inputName,
      options
    }
  }

  if (otherInputs) {
    for (const [inputName, spec] of Object.entries(otherInputs)) {
      inputs[inputName] = { ...spec, name: inputName }
    }
  }

  return { name, inputs } as unknown as ComfyNodeDefImpl
}

/** Helper: create a getNodeDef lookup function from a map of defs */
function makeGetNodeDef(
  defs: Record<string, ComfyNodeDefImpl>
): (nodeType: string) => ComfyNodeDefImpl | undefined {
  return (nodeType) => defs[nodeType]
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
  it('should detect a missing model from a node with COMBO input (array-style)', () => {
    const nodeDefs = {
      CheckpointLoaderSimple: makeNodeDef('CheckpointLoaderSimple', {
        ckpt_name: ['existing_model.safetensors']
      })
    }

    const graphData = makeGraphData([
      makeNode('CheckpointLoaderSimple', ['missing_model.safetensors', 42])
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    expect(result).toEqual([
      {
        nodeId: 1,
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing_model.safetensors',
        isMissing: true
      }
    ])
  })

  it('should not report models that exist in COMBO options', () => {
    const nodeDefs = {
      CheckpointLoaderSimple: makeNodeDef('CheckpointLoaderSimple', {
        ckpt_name: ['sd_xl_base_1.0.safetensors']
      })
    }

    const graphData = makeGraphData([
      makeNode('CheckpointLoaderSimple', ['sd_xl_base_1.0.safetensors'])
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    // Model is in options → isMissing = false
    expect(result).toEqual([
      {
        nodeId: 1,
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'sd_xl_base_1.0.safetensors',
        isMissing: false
      }
    ])
  })

  it('should skip non-model values (no model extension)', () => {
    const nodeDefs = {
      SomeNode: makeNodeDef('SomeNode', {
        mode: ['fast', 'slow']
      })
    }

    const graphData = makeGraphData([
      makeNode('SomeNode', ['custom_mode'])
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    expect(result).toEqual([])
  })

  it('should skip nodes not in nodeDefStore', () => {
    const graphData = makeGraphData([
      makeNode('UnknownNode', ['model.safetensors'])
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      () => undefined,
      noAssetSupport
    )

    expect(result).toEqual([])
  })

  it('should produce separate entries for same model in different nodes', () => {
    const nodeDefs = {
      CheckpointLoaderSimple: makeNodeDef('CheckpointLoaderSimple', {
        ckpt_name: []
      })
    }

    const graphData = makeGraphData([
      makeNode('CheckpointLoaderSimple', ['missing.safetensors'], 1),
      makeNode('CheckpointLoaderSimple', ['missing.safetensors'], 2)
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    // Flat structure: one entry per (node, widget, model)
    expect(result).toHaveLength(2)
    expect(result[0].nodeId).toBe(1)
    expect(result[1].nodeId).toBe(2)
  })

  it('should handle object-style widgets_values (v1 schema)', () => {
    const nodeDefs = {
      LoraLoader: makeNodeDef('LoraLoader', {
        lora_name: ['existing.safetensors']
      })
    }

    const graphData = makeGraphData([
      makeNode('LoraLoader', {
        lora_name: 'custom_lora.safetensors',
        strength: 0.8
      })
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    expect(result).toEqual([
      {
        nodeId: 1,
        nodeType: 'LoraLoader',
        widgetName: 'lora_name',
        isAssetSupported: false,
        name: 'custom_lora.safetensors',
        isMissing: true
      }
    ])
  })

  it('should handle nodes with empty widgets_values', () => {
    const nodeDefs = {
      CheckpointLoaderSimple: makeNodeDef('CheckpointLoaderSimple', {
        ckpt_name: []
      })
    }

    const graphData = makeGraphData([
      makeNode('CheckpointLoaderSimple', [])
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    expect(result).toEqual([])
  })

  it('should detect missing models from custom nodes', () => {
    const nodeDefs = {
      WanVideoModelLoader: makeNodeDef('WanVideoModelLoader', {
        model: ['Wan2_1-I2V-14B.safetensors']
      }),
      WanVideoLoraSelect: makeNodeDef('WanVideoLoraSelect', {
        lora: ['default_lora.safetensors']
      })
    }

    const graphData = makeGraphData([
      makeNode(
        'WanVideoModelLoader',
        ['Wan2_1-I2V-14B-480P_fp8_e4m3fn.safetensors'],
        1
      ),
      makeNode('WanVideoLoraSelect', ['SquishSquish_18.safetensors', 1.0], 2)
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.name)).toEqual([
      'Wan2_1-I2V-14B-480P_fp8_e4m3fn.safetensors',
      'SquishSquish_18.safetensors'
    ])
  })

  it('should detect multiple missing models from different nodes', () => {
    const nodeDefs = {
      CheckpointLoaderSimple: makeNodeDef('CheckpointLoaderSimple', {
        ckpt_name: []
      }),
      LoraLoader: makeNodeDef('LoraLoader', {
        lora_name: []
      }),
      VAELoader: makeNodeDef('VAELoader', {
        vae_name: []
      })
    }

    const graphData = makeGraphData([
      makeNode('CheckpointLoaderSimple', ['model_a.safetensors'], 1),
      makeNode('LoraLoader', ['lora_b.safetensors', 0.8, 0.8], 2),
      makeNode('VAELoader', ['vae_c.safetensors'], 3)
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    expect(result).toHaveLength(3)
  })

  it('should handle whitespace-only widget values', () => {
    const nodeDefs = {
      CheckpointLoaderSimple: makeNodeDef('CheckpointLoaderSimple', {
        ckpt_name: []
      })
    }

    const graphData = makeGraphData([
      makeNode('CheckpointLoaderSimple', ['  ', ''])
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    expect(result).toEqual([])
  })

  it('should set isMissing=undefined for asset-supported nodes', () => {
    const nodeDefs = {
      CheckpointLoaderSimple: makeNodeDef('CheckpointLoaderSimple', {
        ckpt_name: []
      })
    }

    const graphData = makeGraphData([
      makeNode('CheckpointLoaderSimple', ['missing.safetensors'])
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      () => true // All nodes are asset-supported
    )

    expect(result).toHaveLength(1)
    expect(result[0].isAssetSupported).toBe(true)
    expect(result[0].isMissing).toBeUndefined()
  })

  it('should set isMissing=true for non-asset nodes with missing model', () => {
    const nodeDefs = {
      CustomLoader: makeNodeDef('CustomLoader', {
        model: []
      })
    }

    const graphData = makeGraphData([
      makeNode('CustomLoader', ['custom.safetensors'])
    ] as ComfyWorkflowJSON['nodes'])

    const { candidates: result } = scanAllModelCandidates(
      graphData,
      makeGetNodeDef(nodeDefs),
      noAssetSupport
    )

    expect(result).toHaveLength(1)
    expect(result[0].isAssetSupported).toBe(false)
    expect(result[0].isMissing).toBe(true)
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

function makeEmbeddedNode(
  id: number,
  type: string,
  widgetsValues: Record<string, unknown>
): ComfyNode {
  return { id, type, widgets_values: widgetsValues } as ComfyNode
}

const alwaysMissing = async () => false
const alwaysInstalled = async () => true

describe('enrichWithEmbeddedMetadata', () => {
  it('enriches existing candidate with url and directory from embedded metadata', async () => {
    const candidates = [makeCandidate('model_a.safetensors')]
    const allNodes = [
      makeEmbeddedNode(1, 'CheckpointLoaderSimple', {
        ckpt_name: 'model_a.safetensors'
      })
    ]
    const graphData = {
      nodes: allNodes,
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

    await enrichWithEmbeddedMetadata(
      candidates,
      allNodes,
      graphData,
      alwaysMissing
    )

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
    const allNodes = [
      makeEmbeddedNode(1, 'CheckpointLoaderSimple', {
        ckpt_name: 'model_a.safetensors'
      })
    ]
    const graphData = {
      nodes: allNodes,
      models: [
        {
          name: 'model_a.safetensors',
          url: 'https://new.com',
          directory: 'new_dir'
        }
      ]
    } as unknown as ComfyWorkflowJSON

    await enrichWithEmbeddedMetadata(
      candidates,
      allNodes,
      graphData,
      alwaysMissing
    )

    // ??= should not overwrite existing values
    expect(candidates[0].url).toBe('https://existing.com')
    expect(candidates[0].directory).toBe('existing_dir')
  })

  it('adds new candidate for embedded model not found by COMBO scan', async () => {
    const candidates: MissingModelCandidate[] = []
    const allNodes = [
      makeEmbeddedNode(1, 'CheckpointLoaderSimple', {
        ckpt_name: 'model_a.safetensors'
      })
    ]
    const graphData = {
      nodes: allNodes,
      models: [
        {
          name: 'model_a.safetensors',
          url: 'https://example.com/model_a',
          directory: 'checkpoints'
        }
      ]
    } as unknown as ComfyWorkflowJSON

    await enrichWithEmbeddedMetadata(
      candidates,
      allNodes,
      graphData,
      alwaysMissing
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0].name).toBe('model_a.safetensors')
    expect(candidates[0].isMissing).toBe(true)
  })

  it('does not add candidate when model is already installed', async () => {
    const candidates: MissingModelCandidate[] = []
    const allNodes: ComfyNode[] = []
    const graphData = {
      nodes: allNodes,
      models: [
        {
          name: 'installed_model.safetensors',
          url: 'https://example.com',
          directory: 'checkpoints'
        }
      ]
    } as unknown as ComfyWorkflowJSON

    await enrichWithEmbeddedMetadata(
      candidates,
      allNodes,
      graphData,
      alwaysInstalled
    )

    expect(candidates).toHaveLength(0)
  })
})
