import { describe, expect, it } from 'vitest'

import { flattenInputSpecs } from '@/schemas/nodeDef/inputSpecUtil'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

describe('flattenInputSpecs', () => {
  it('includes a dynamic combo input alongside its nested per-option inputs', () => {
    const nodeDef: ComfyNodeDefV1 = {
      name: 'SyncLipSyncNode',
      display_name: 'sync.so Lip Sync',
      category: 'partner/video/sync.so',
      python_module: 'comfy_api_nodes.nodes_sync_so',
      description: 'Re-sync mouth movement in a video.',
      input: {
        required: {
          video: ['VIDEO', { tooltip: 'Footage of the speaker.' }],
          audio: ['AUDIO', { tooltip: 'Speech audio.' }],
          model: [
            'COMFY_DYNAMICCOMBO_V3',
            {
              tooltip: 'sync.so generation model.',
              options: [
                {
                  key: 'sync-3',
                  inputs: {
                    required: {
                      sync_mode: [
                        'COMBO',
                        { options: ['bounce', 'cut_off'], default: 'bounce' }
                      ]
                    },
                    optional: {
                      speaker_frame: [
                        'INT',
                        {
                          advanced: true,
                          tooltip: 'Video frame used to locate the speaker.'
                        }
                      ],
                      speaker_x: [
                        'INT',
                        { advanced: true, tooltip: 'X pixel coordinate.' }
                      ]
                    }
                  }
                }
              ]
            }
          ]
        },
        optional: {}
      },
      output: ['VIDEO'],
      output_is_list: [false],
      output_name: ['video'],
      output_node: false
    } as ComfyNodeDefV1

    const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)
    const result = flattenInputSpecs(nodeDefImpl.inputs)
    const byName = Object.fromEntries(result.map((spec) => [spec.name, spec]))

    expect(Object.keys(byName)).toEqual([
      'video',
      'audio',
      'model',
      'sync_mode',
      'speaker_frame',
      'speaker_x'
    ])
    expect(byName.speaker_frame?.advanced).toBe(true)
    expect(byName.speaker_frame?.tooltip).toBe(
      'Video frame used to locate the speaker.'
    )
    expect(byName.speaker_x?.isOptional).toBe(true)
  })

  it('returns inputs unchanged when there is no dynamic combo', () => {
    const nodeDefImpl = new ComfyNodeDefImpl({
      name: 'PlainNode',
      display_name: 'Plain Node',
      category: 'Test',
      python_module: 'test_module',
      description: 'A node with no dynamic combo',
      input: {
        required: { seed: ['INT', { default: 0 }] },
        optional: {}
      },
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    } as ComfyNodeDefV1)

    const result = flattenInputSpecs(nodeDefImpl.inputs)

    expect(result.map((spec) => spec.name)).toEqual(['seed'])
  })

  it('first-occurrence wins when two options declare the same input name', () => {
    const nodeDef: ComfyNodeDefV1 = {
      name: 'MultiOptionNode',
      display_name: 'Multi Option Node',
      category: 'Test',
      python_module: 'test_module',
      description: 'A node with two options declaring the same input name',
      input: {
        required: {
          model: [
            'COMFY_DYNAMICCOMBO_V3',
            {
              options: [
                {
                  key: 'option-a',
                  inputs: {
                    optional: {
                      threshold: [
                        'FLOAT',
                        { tooltip: 'From option A', default: 0.1 }
                      ]
                    }
                  }
                },
                {
                  key: 'option-b',
                  inputs: {
                    optional: {
                      threshold: [
                        'INT',
                        { tooltip: 'From option B', default: 5 }
                      ]
                    }
                  }
                }
              ]
            }
          ]
        },
        optional: {}
      },
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    } as ComfyNodeDefV1

    const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)
    const result = flattenInputSpecs(nodeDefImpl.inputs)
    const thresholdSpecs = result.filter((spec) => spec.name === 'threshold')

    expect(thresholdSpecs).toHaveLength(1)
    expect(thresholdSpecs[0]?.tooltip).toBe('From option A')
    expect(thresholdSpecs[0]?.type).toBe('FLOAT')
  })

  it('handles a dynamic combo with no options gracefully', () => {
    const nodeDef: ComfyNodeDefV1 = {
      name: 'EmptyOptionsNode',
      display_name: 'Empty Options Node',
      category: 'Test',
      python_module: 'test_module',
      description: 'A node with a dynamic combo that has no options',
      input: {
        required: {
          model: ['COMFY_DYNAMICCOMBO_V3', { options: [] }]
        },
        optional: {}
      },
      output: [],
      output_is_list: [],
      output_name: [],
      output_node: false
    } as ComfyNodeDefV1

    const nodeDefImpl = new ComfyNodeDefImpl(nodeDef)

    expect(() => flattenInputSpecs(nodeDefImpl.inputs)).not.toThrow()
    const result = flattenInputSpecs(nodeDefImpl.inputs)
    expect(result.map((spec) => spec.name)).toEqual(['model'])
  })
})
