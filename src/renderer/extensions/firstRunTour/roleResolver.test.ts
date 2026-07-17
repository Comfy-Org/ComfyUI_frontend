import { describe, expect, it } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

import {
  fromWorkflowJson,
  resolveRoles,
  templateOverrides
} from './roleResolver'

describe('templateOverrides applied to the graph', () => {
  it('override sink, engine, and media win over the heuristics on the graph', () => {
    const pin = templateOverrides.image_z_image_turbo
    const roles = resolveRoles(
      workflow([
        node(900, 'SaveVideo', {
          inputs: [{ name: 'video', type: 'VIDEO', link: 1 }]
        })
      ]),
      'image_z_image_turbo'
    )

    expect(roles.sink?.nodeId).toBe(pin.sinkNodeId)
    expect(roles.engine?.nodeId).toBe(pin.engineNodeId)
    expect(roles.mediaKind).toBe(pin.mediaKind)
    expect(roles.sink?.nodeId).not.toBe(toNodeId(900))
    expect(roles.mediaKind).not.toBe('video')
  })

  it('degrades the prompt to null when the pinned inner node is absent', () => {
    const roles = resolveRoles(
      workflow([
        node(900, 'SaveImage', {
          inputs: [{ name: 'images', type: 'IMAGE', link: 1 }]
        })
      ]),
      'image_z_image_turbo'
    )

    expect(roles.prompt).toBeNull()
  })

  it('spotlights the subgraph host, not the pinned inner node, for a nested prompt', () => {
    const subgraphId = '33333333-3333-3333-3333-333333333333'
    const pin = templateOverrides.image_z_image_turbo
    const roles = resolveRoles(
      {
        ...workflow([
          node(50, subgraphId, { inputs: [] }),
          node(9, 'SaveImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 8 }]
          })
        ]),
        definitions: {
          subgraphs: [
            {
              id: subgraphId,
              inputs: [],
              nodes: [cte(Number(pin.promptNodeId), 4, 'a red fox')],
              links: []
            }
          ]
        }
      } as unknown as ComfyWorkflowJSON,
      'image_z_image_turbo'
    )

    expect(roles.prompt?.innerNodeId).toBe(pin.promptNodeId)
    expect(roles.prompt?.subgraphNodeId).toBe(toNodeId(50))
  })

  it('ignores an unknown template id and falls back to heuristics', () => {
    const graph = workflow(
      [
        cte(6, 4, 'a red fox'),
        node(3, 'KSampler', {
          inputs: [{ name: 'positive', type: 'CONDITIONING', link: 4 }]
        }),
        node(9, 'SaveImage', {
          inputs: [{ name: 'images', type: 'IMAGE', link: 8 }]
        })
      ],
      [
        [4, 6, 0, 3, 1, 'CONDITIONING'],
        [8, 3, 0, 9, 0, 'IMAGE']
      ]
    )
    expect(resolveRoles(graph, 'not_a_real_template')).toEqual(
      resolveRoles(graph)
    )
  })
})

function workflow(nodes: unknown[], links: unknown[] = []): ComfyWorkflowJSON {
  return {
    version: 0.4,
    nodes,
    links,
    extra: {}
  } as unknown as ComfyWorkflowJSON
}

function node(
  id: number,
  type: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    type,
    pos: [0, 0],
    size: [1, 1],
    flags: {},
    order: id,
    mode: 0,
    properties: {},
    ...extra
  }
}

function cte(id: number, conditioningLink: number, text: string) {
  return node(id, 'CLIPTextEncode', {
    inputs: [{ name: 'text', type: 'STRING' }],
    outputs: [
      { name: 'CONDITIONING', type: 'CONDITIONING', links: [conditioningLink] }
    ],
    widgets_values: [text]
  })
}

describe('resolveRoles — arbitrary (non-curated) graphs', () => {
  it('resolves a top-level T2I, choosing the positive prompt by conditioning', () => {
    const roles = resolveRoles(
      workflow(
        [
          cte(6, 4, 'a red fox'),
          cte(7, 6, 'blurry'),
          node(3, 'KSampler', {
            inputs: [
              { name: 'positive', type: 'CONDITIONING', link: 4 },
              { name: 'negative', type: 'CONDITIONING', link: 6 }
            ]
          }),
          node(9, 'SaveImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 8 }]
          })
        ],
        [
          [4, 6, 0, 3, 1, 'CONDITIONING'],
          [6, 7, 0, 3, 2, 'CONDITIONING'],
          [8, 3, 0, 9, 0, 'IMAGE']
        ]
      )
    )

    expect(roles.source).toBeNull()
    expect(roles.prompt?.innerNodeId).toBe(toNodeId(6))
    expect(roles.prompt?.widgetName).toBe('text')
    expect(roles.engine?.nodeId).toBe(toNodeId(3))
    expect(roles.sink?.nodeId).toBe(toNodeId(9))
    expect(roles.mediaKind).toBe('image')
  })

  it('resolves a top-level I2V with a video sink', () => {
    const roles = resolveRoles(
      workflow(
        [
          node(1, 'LoadImage', {
            outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [10] }]
          }),
          cte(2, 11, 'dancing'),
          node(3, 'KSamplerAdvanced', {
            inputs: [{ name: 'positive', type: 'CONDITIONING', link: 11 }]
          }),
          node(4, 'SaveVideo', {
            inputs: [{ name: 'video', type: 'VIDEO', link: 12 }]
          })
        ],
        [
          [10, 1, 0, 3, 3, 'IMAGE'],
          [11, 2, 0, 3, 1, 'CONDITIONING'],
          [12, 3, 0, 4, 0, 'VIDEO']
        ]
      )
    )

    expect(roles.source?.nodeId).toBe(toNodeId(1))
    expect(roles.prompt?.innerNodeId).toBe(toNodeId(2))
    expect(roles.engine?.nodeId).toBe(toNodeId(3))
    expect(roles.sink?.nodeId).toBe(toNodeId(4))
    expect(roles.mediaKind).toBe('video')
  })

  it('prefers a Save sink over a Preview sink', () => {
    const roles = resolveRoles(
      workflow(
        [
          cte(6, 4, 'x'),
          node(3, 'KSampler', {
            inputs: [{ name: 'positive', type: 'CONDITIONING', link: 4 }]
          }),
          node(9, 'SaveImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 8 }]
          }),
          node(19, 'PreviewImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 20 }]
          })
        ],
        [
          [4, 6, 0, 3, 1, 'CONDITIONING'],
          [8, 3, 0, 9, 0, 'IMAGE'],
          [20, 3, 0, 19, 0, 'IMAGE']
        ]
      )
    )

    expect(roles.sink?.nodeId).toBe(toNodeId(9))
  })

  it('resolves top-level prompt and engine past an unrelated subgraph', () => {
    const subgraphId = '22222222-2222-2222-2222-222222222222'
    const graph = {
      ...workflow(
        [
          node(1, subgraphId, { inputs: [] }),
          cte(6, 4, 'a red fox'),
          node(3, 'KSampler', {
            inputs: [{ name: 'positive', type: 'CONDITIONING', link: 4 }]
          }),
          node(9, 'SaveImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 8 }]
          })
        ],
        [
          [4, 6, 0, 3, 1, 'CONDITIONING'],
          [8, 3, 0, 9, 0, 'IMAGE']
        ]
      ),
      definitions: {
        subgraphs: [
          {
            id: subgraphId,
            inputs: [],
            nodes: [node(10, 'VAEDecode', { inputs: [] })],
            links: []
          }
        ]
      }
    } as unknown as ComfyWorkflowJSON

    const roles = resolveRoles(graph)
    expect(roles.prompt?.innerNodeId).toBe(toNodeId(6))
    expect(roles.engine?.nodeId).toBe(toNodeId(3))
    expect(roles.sink?.nodeId).toBe(toNodeId(9))
  })
})

describe('fromWorkflowJson normalizes the serialized shape', () => {
  it('reads tuple links at the top level', () => {
    const graph = fromWorkflowJson(
      workflow(
        [
          node(1, 'KSampler', {
            outputs: [{ name: 'LATENT', type: 'LATENT', links: [5] }]
          }),
          node(2, 'SaveImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 5 }]
          })
        ],
        [[5, 1, 0, 2, 0, 'IMAGE']]
      )
    )

    expect(graph.nodes[0].hasOutgoingLinks).toBe(true)
    expect(graph.nodes[1].inputs[0].origin).toEqual({
      kind: 'node',
      nodeId: toNodeId(1),
      slot: 0
    })
  })

  it('reads object links and the boundary origin inside subgraphs', () => {
    const subgraphId = '44444444-4444-4444-4444-444444444444'
    const graph = fromWorkflowJson({
      ...workflow([node(50, subgraphId, { inputs: [] })]),
      definitions: {
        subgraphs: [
          {
            id: subgraphId,
            inputs: [{ name: 'text', type: 'STRING' }],
            nodes: [
              node(27, 'CLIPTextEncode', {
                inputs: [{ name: 'text', type: 'STRING', link: 7 }]
              })
            ],
            links: [
              {
                id: 7,
                origin_id: -10,
                origin_slot: 0,
                target_id: 27,
                target_slot: 0
              }
            ]
          }
        ]
      }
    } as unknown as ComfyWorkflowJSON)
    const clip = graph.subgraphs[0].nodes.find((n) => n.id === toNodeId(27))
    const textInput = clip?.inputs.find((i) => i.name === 'text')

    expect(textInput?.origin).toEqual({ kind: 'boundary', slot: 0 })
  })

  it('flags the hosting subgraph node', () => {
    const subgraphId = '44444444-4444-4444-4444-444444444444'
    const graph = fromWorkflowJson({
      ...workflow([node(50, subgraphId, { inputs: [] })]),
      definitions: {
        subgraphs: [{ id: subgraphId, inputs: [], nodes: [], links: [] }]
      }
    } as unknown as ComfyWorkflowJSON)
    const host = graph.nodes.find((n) => n.subgraphId !== null)

    expect(host?.subgraphId).toBe(graph.subgraphs[0].id)
  })
})

describe('resolveRoles — graceful degradation for any input', () => {
  it('returns all-null roles for a graph with no sink or prompt', () => {
    const roles = resolveRoles(
      workflow([node(1, 'MarkdownNote'), node(2, 'Reroute')])
    )
    expect(roles.source).toBeNull()
    expect(roles.prompt).toBeNull()
    expect(roles.engine).toBeNull()
    expect(roles.sink).toBeNull()
    expect(roles.mediaKind).toBe('image')
  })

  it('does not throw on an empty graph', () => {
    expect(() => resolveRoles(workflow([]))).not.toThrow()
  })

  it('resolves the sink even when the prompt is missing', () => {
    const roles = resolveRoles(
      workflow([
        node(9, 'SaveVideo', {
          inputs: [{ name: 'video', type: 'VIDEO', link: 1 }]
        })
      ])
    )
    expect(roles.sink?.nodeId).toBe(toNodeId(9))
    expect(roles.mediaKind).toBe('video')
    expect(roles.prompt).toBeNull()
  })

  it('leaves the prompt null when a subgraph port leads to no editable node', () => {
    const subgraphId = '11111111-1111-1111-1111-111111111111'
    const graph = {
      ...workflow([
        node(1, subgraphId, { inputs: [] }),
        node(2, 'SaveImage', {
          inputs: [{ name: 'images', type: 'IMAGE', link: 5 }]
        })
      ]),
      definitions: {
        subgraphs: [
          {
            id: subgraphId,
            inputs: [{ name: 'text', type: 'STRING', label: 'prompt' }],
            nodes: [node(10, 'VAEDecode', { inputs: [] })],
            links: []
          }
        ]
      }
    } as unknown as ComfyWorkflowJSON

    const roles = resolveRoles(graph)
    expect(roles.prompt).toBeNull()
    expect(roles.sink?.nodeId).toBe(toNodeId(2))
  })

  it('skips malformed link entries without throwing', () => {
    const graph = {
      ...workflow(
        [
          node(9, 'SaveImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 8 }]
          })
        ],
        [null, 'garbage', [8, 3, 0, 9, 0, 'IMAGE']]
      )
    } as unknown as ComfyWorkflowJSON

    expect(() => resolveRoles(graph)).not.toThrow()
    expect(resolveRoles(graph).sink?.nodeId).toBe(toNodeId(9))
  })

  it('prefers a terminal Save sink over a Save that feeds onward', () => {
    const roles = resolveRoles(
      workflow(
        [
          node(1, 'SaveImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 4 }],
            outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [5] }]
          }),
          node(2, 'SaveImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 6 }]
          })
        ],
        [
          [5, 1, 0, 2, 0, 'IMAGE'],
          [6, 1, 0, 2, 0, 'IMAGE']
        ]
      )
    )
    expect(roles.sink?.nodeId).toBe(toNodeId(2))
  })
})

describe('resolveRoles — hostile node types do not match prototype members', () => {
  it('does not treat a node typed "constructor" as a sink', () => {
    const roles = resolveRoles(
      workflow([node(1, 'constructor', { inputs: [] })])
    )
    expect(roles.sink).toBeNull()
    expect(roles.mediaKind).toBe('image')
  })

  it('ignores a template id that names a prototype member', () => {
    const graph = workflow(
      [
        cte(6, 4, 'a red fox'),
        node(3, 'KSampler', {
          inputs: [{ name: 'positive', type: 'CONDITIONING', link: 4 }]
        }),
        node(9, 'SaveImage', {
          inputs: [{ name: 'images', type: 'IMAGE', link: 8 }]
        })
      ],
      [
        [4, 6, 0, 3, 1, 'CONDITIONING'],
        [8, 3, 0, 9, 0, 'IMAGE']
      ]
    )
    const heuristic = resolveRoles(graph)
    for (const id of ['constructor', 'toString', 'hasOwnProperty']) {
      expect(resolveRoles(graph, id)).toEqual(heuristic)
    }
  })
})

describe('resolveRoles — registry-backed sink fallback', () => {
  // A custom save node outside the hardcoded SINK_MEDIA list, only recognizable
  // as a sink through the injected registry lookup.
  const customSinkGraph = workflow([
    node(9, 'MyCustomVideoSave', {
      inputs: [{ name: 'video', type: 'VIDEO', link: 1 }]
    })
  ])

  const lookup = (type: string) =>
    type === 'MyCustomVideoSave'
      ? { isOutputNode: true, producesVideo: true }
      : null

  it('resolves a custom output node as the sink when the type list misses', () => {
    const roles = resolveRoles(customSinkGraph, undefined, lookup)

    expect(roles.sink?.nodeId).toBe(toNodeId(9))
    expect(roles.mediaKind).toBe('video')
  })

  it('leaves the sink null for the same graph without a registry lookup', () => {
    const roles = resolveRoles(customSinkGraph)

    expect(roles.sink).toBeNull()
    expect(roles.mediaKind).toBe('image')
  })

  it('does not use the fallback when a known sink type already matches', () => {
    // A registry that would (wrongly) label the KSampler an output node must not
    // steal the sink from the real SaveImage.
    const greedyLookup = () => ({ isOutputNode: true, producesVideo: false })
    const roles = resolveRoles(
      workflow(
        [
          node(3, 'KSampler', {
            outputs: [{ name: 'LATENT', type: 'LATENT', links: [8] }]
          }),
          node(9, 'SaveImage', {
            inputs: [{ name: 'images', type: 'IMAGE', link: 8 }]
          })
        ],
        [[8, 3, 0, 9, 0, 'IMAGE']]
      ),
      undefined,
      greedyLookup
    )

    expect(roles.sink?.nodeId).toBe(toNodeId(9))
  })

  it('ignores a registry output node that still feeds downstream', () => {
    // Only terminal output nodes are sinks; one with outgoing links is not.
    const roles = resolveRoles(
      workflow(
        [
          node(9, 'MyCustomVideoSave', {
            inputs: [{ name: 'video', type: 'VIDEO', link: 1 }],
            outputs: [{ name: 'VIDEO', type: 'VIDEO', links: [2] }]
          }),
          node(10, 'MyCustomVideoSave', {
            inputs: [{ name: 'video', type: 'VIDEO', link: 2 }]
          })
        ],
        [[2, 9, 0, 10, 0, 'VIDEO']]
      ),
      undefined,
      lookup
    )

    expect(roles.sink?.nodeId).toBe(toNodeId(10))
  })

  it('does not treat a non-output registry node as a sink', () => {
    const roles = resolveRoles(
      workflow([node(9, 'MyCustomImageSave', { inputs: [] })]),
      undefined,
      (type: string) =>
        type === 'MyCustomImageSave'
          ? { isOutputNode: false, producesVideo: false }
          : null
    )

    // isOutputNode:false → not a sink at all, so it stays null.
    expect(roles.sink).toBeNull()
  })

  it('infers image media for an accepted output node with no video output', () => {
    const roles = resolveRoles(
      workflow([node(9, 'MyCustomImageSave', { inputs: [] })]),
      undefined,
      (type: string) =>
        type === 'MyCustomImageSave'
          ? { isOutputNode: true, producesVideo: false }
          : null
    )

    expect(roles.sink?.nodeId).toBe(toNodeId(9))
    expect(roles.mediaKind).toBe('image')
  })
})
