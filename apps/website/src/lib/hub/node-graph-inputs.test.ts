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
      name: 'reads the default "Load Image" title as the media type',
      graph: { nodes: [{ type: 'LoadImage', title: 'Load Image' }] },
      expected: [{ media: 'image', title: 'Image' }]
    },
    {
      name: 'keeps acronyms and names as the author wrote them',
      graph: {
        nodes: [{ type: 'LoadVideo', title: 'Load SDXL Driving Video' }]
      },
      expected: [{ media: 'video', title: 'SDXL driving video' }]
    },
    {
      name: 'finds loaders inside subgraphs and skips other nodes',
      graph: {
        nodes: [{ type: 'SaveVideo' }],
        definitions: {
          subgraphs: [{ nodes: [{ type: 'LoadAudio', title: 'Voice' }] }]
        }
      },
      expected: [{ media: 'audio', title: 'Voice' }]
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
