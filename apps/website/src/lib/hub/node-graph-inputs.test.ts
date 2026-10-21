import { describe, expect, it } from 'vitest'

import { nodeGraphInputs } from './node-graph-inputs'

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
