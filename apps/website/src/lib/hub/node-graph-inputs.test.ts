import { describe, expect, it } from 'vitest'

import { nodeGraphCustomNodes, nodeGraphInputs } from './node-graph-inputs'

describe('nodeGraphInputs', () => {
  it.for([
    {
      name: 'labels a titled loader with its title, minus "Load"',
      graph: { nodes: [{ type: 'LoadImage', title: 'Load Character Image' }] },
      expected: [{ media: 'image', title: 'Character image' }]
    },
    {
      name: 'leaves an untitled loader to its media type',
      graph: { nodes: [{ type: 'LoadImage' }] },
      expected: [{ media: 'image', title: undefined }]
    },
    {
      name: 'leaves a default title such as "Load Image" to the media type',
      graph: {
        nodes: [
          { type: 'LoadImage', title: 'Load Image' },
          { type: 'LoadVideo', title: 'Load' }
        ]
      },
      expected: [
        { media: 'image', title: undefined },
        { media: 'video', title: undefined }
      ]
    },
    {
      name: 'keeps acronyms and names as the author wrote them',
      graph: {
        nodes: [
          { type: 'LoadVideo', title: 'Load SDXL Driving Video' },
          { type: 'LoadImage', title: 'Load Portrait Of Alice' }
        ]
      },
      expected: [
        { media: 'video', title: 'SDXL Driving video' },
        { media: 'image', title: 'Portrait Of Alice' }
      ]
    },
    {
      name: 'keeps the valid loaders when other entries are malformed',
      graph: {
        nodes: [
          null,
          'LoadImage',
          { type: 'constructor' },
          { type: 'LoadAudio' }
        ]
      },
      expected: [{ media: 'audio', title: undefined }]
    },
    {
      name: 'finds loaders inside the subgraphs the graph uses',
      graph: {
        nodes: [{ type: 'SaveVideo' }, { type: 'voice-subgraph' }],
        definitions: {
          subgraphs: [
            {
              id: 'voice-subgraph',
              nodes: [{ type: 'LoadAudio', title: 'Voice' }]
            },
            { id: 'unused', nodes: [{ type: 'LoadImage', title: 'Unused' }] }
          ]
        }
      },
      expected: [{ media: 'audio', title: 'Voice' }]
    },
    {
      name: 'skips muted and bypassed loaders',
      graph: {
        nodes: [
          { type: 'LoadImage', title: 'Muted', mode: 2 },
          { type: 'LoadImage', title: 'Bypassed', mode: 4 },
          { type: 'VHS_LoadVideo', title: 'Load Driving Video', mode: 0 }
        ]
      },
      expected: [{ media: 'video', title: 'Driving video' }]
    },
    {
      name: 'keeps mask loaders, which the detail pages do not take as files',
      graph: {
        nodes: [{ type: 'LoadImageMask', title: 'Edit mask (white = edit)' }]
      },
      expected: [{ media: 'image', title: 'Edit mask (white = edit)' }]
    },
    {
      name: 'capitalizes the label once "Load" is removed',
      graph: { nodes: [{ type: 'LoadImage', title: 'Load reference photo' }] },
      expected: [{ media: 'image', title: 'Reference photo' }]
    },
    {
      name: 'returns nothing for a file that is not a graph',
      graph: 'not a graph',
      expected: []
    }
  ])('$name', ({ graph, expected }) => {
    expect(nodeGraphInputs(graph)).toEqual(expected)
  })
})

const node = (properties: Record<string, string>, mode = 0) => ({
  type: 'SomeNode',
  mode,
  properties
})

describe('nodeGraphCustomNodes', () => {
  it.for([
    {
      name: 'lists nothing for a graph of core nodes',
      graph: { nodes: [node({ cnr_id: 'comfy-core' }), { type: 'Reroute' }] },
      expected: []
    },
    {
      name: 'names each pack once, by its known name, repo or registry id',
      graph: {
        nodes: [
          node({ cnr_id: 'comfyui-kjnodes' }),
          node({ cnr_id: 'comfyui-kjnodes', aux_id: 'kijai/ComfyUI-KJNodes' }),
          node({ cnr_id: 'comfyui_essentials' }),
          node({ cnr_id: '', aux_id: 'evanspearman/ComfyMath' }),
          node({ cnr_id: '', aux_id: 'someone/Other-Pack' })
        ]
      },
      expected: [
        'ComfyUI-KJNodes',
        'comfyui_essentials',
        'ComfyMath',
        'Other-Pack'
      ]
    },
    {
      name: 'skips bypassed nodes and reads used subgraphs',
      graph: {
        nodes: [
          node({ cnr_id: 'bypassed-pack' }, 4),
          { type: 'video-subgraph' }
        ],
        definitions: {
          subgraphs: [
            {
              id: 'video-subgraph',
              nodes: [node({ aux_id: 'Lightricks/ComfyUI-LTXVideo' })]
            }
          ]
        }
      },
      expected: ['ComfyUI-LTXVideo']
    }
  ])('$name', ({ graph, expected }) => {
    expect(nodeGraphCustomNodes(graph)).toEqual(expected)
  })

  it('lists a subgraph input once for each place the subgraph is used', () => {
    const graph = {
      nodes: [{ type: 'frame' }, { type: 'frame' }, { type: 'frame', mode: 4 }],
      definitions: {
        subgraphs: [
          { id: 'frame', nodes: [{ type: 'LoadImage', title: 'Frame image' }] }
        ]
      }
    }

    expect(nodeGraphInputs(graph)).toEqual([
      { media: 'image', title: 'Frame image' },
      { media: 'image', title: 'Frame image' }
    ])
  })

  it('stays bounded however often and deeply subgraphs are nested', () => {
    const instances = (type: string) =>
      Array.from({ length: 50 }, () => ({ type }))
    const graph = {
      nodes: instances('s0'),
      definitions: {
        subgraphs: [
          { id: 's0', nodes: instances('s1') },
          { id: 's1', nodes: instances('s2') },
          { id: 's2', nodes: instances('s3') },
          { id: 's3', nodes: [{ type: 'LoadImage' }] }
        ]
      }
    }

    expect(nodeGraphInputs(graph)).toHaveLength(5000)
  })

  it('stops at a subgraph that contains itself', () => {
    const graph = {
      nodes: [{ type: 'loop' }],
      definitions: {
        subgraphs: [
          { id: 'loop', nodes: [{ type: 'loop' }, { type: 'LoadAudio' }] }
        ]
      }
    }

    expect(nodeGraphInputs(graph)).toEqual([
      { media: 'audio', title: undefined }
    ])
  })
})
