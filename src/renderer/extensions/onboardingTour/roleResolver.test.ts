import { describe, expect, it } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

import type { CuratedTemplateId } from './__fixtures__/loadTemplateWorkflow'
import { loadTemplateWorkflow } from './__fixtures__/loadTemplateWorkflow'
import {
  fromWorkflowJson,
  resolveRoles,
  templateOverrides
} from './roleResolver'

interface CuratedExpectation {
  sourceId: number | null
  promptInnerId: number
  promptWidget: string
  engineId: number
  sinkId: number
  mediaKind: 'image' | 'video'
}

const CURATED: Record<CuratedTemplateId, CuratedExpectation> = {
  image_krea2_turbo_t2i: {
    sourceId: null,
    promptInnerId: 19,
    promptWidget: 'value',
    engineId: 3,
    sinkId: 29,
    mediaKind: 'image'
  },
  image_z_image_turbo: {
    sourceId: null,
    promptInnerId: 27,
    promptWidget: 'text',
    engineId: 3,
    sinkId: 9,
    mediaKind: 'image'
  },
  video_ltx2_3_i2v: {
    sourceId: 269,
    promptInnerId: 319,
    promptWidget: 'value',
    engineId: 283,
    sinkId: 75,
    mediaKind: 'video'
  },
  video_wan2_2_14B_i2v: {
    sourceId: 97,
    promptInnerId: 93,
    promptWidget: 'text',
    engineId: 86,
    sinkId: 108,
    mediaKind: 'video'
  },
  flux_kontext_dev_basic: {
    sourceId: 190,
    promptInnerId: 6,
    promptWidget: 'text',
    engineId: 31,
    sinkId: 136,
    mediaKind: 'image'
  }
}

const curatedIds = Object.keys(CURATED) as CuratedTemplateId[]

describe('resolveRoles — curated templates, heuristics only (no override)', () => {
  it.for(curatedIds)('resolves %s from its real JSON', (id) => {
    const expected = CURATED[id]
    const roles = resolveRoles(loadTemplateWorkflow(id))

    if (expected.sourceId === null) {
      expect(roles.source).toBeNull()
    } else {
      expect(roles.source?.nodeId).toBe(toNodeId(expected.sourceId))
    }
    expect(roles.prompt?.innerNodeId).toBe(toNodeId(expected.promptInnerId))
    expect(roles.prompt?.widgetName).toBe(expected.promptWidget)
    expect(roles.engine?.nodeId).toBe(toNodeId(expected.engineId))
    expect(roles.sink?.nodeId).toBe(toNodeId(expected.sinkId))
    expect(roles.mediaKind).toBe(expected.mediaKind)
  })

  it('rejects the internal-fed decoy CLIPTextEncode (krea 6, ltx 303)', () => {
    expect(
      resolveRoles(loadTemplateWorkflow('image_krea2_turbo_t2i')).prompt
        ?.innerNodeId
    ).not.toBe(toNodeId(6))
    expect(
      resolveRoles(loadTemplateWorkflow('video_ltx2_3_i2v')).prompt?.innerNodeId
    ).not.toBe(toNodeId(303))
  })

  it('picks the boundary-fed user prompt over a sibling system prompt (krea)', () => {
    const roles = resolveRoles(loadTemplateWorkflow('image_krea2_turbo_t2i'))
    expect(roles.prompt?.innerNodeId).toBe(toNodeId(19))
  })

  it('picks the positive CLIPTextEncode over the negative one (wan)', () => {
    const roles = resolveRoles(loadTemplateWorkflow('video_wan2_2_14B_i2v'))
    expect(roles.prompt?.innerNodeId).toBe(toNodeId(93))
  })

  it('picks one source when several LoadImage exist (flux)', () => {
    const roles = resolveRoles(loadTemplateWorkflow('flux_kontext_dev_basic'))
    expect(roles.source?.nodeId).toBe(toNodeId(190))
  })

  it('exposes the subgraph node id and prompt port for fallback', () => {
    const zImage = resolveRoles(loadTemplateWorkflow('image_z_image_turbo'))
    expect(zImage.prompt?.subgraphNodeId).toBe(toNodeId(57))
    expect(zImage.prompt?.portFallback).toBe('text')

    const ltx = resolveRoles(loadTemplateWorkflow('video_ltx2_3_i2v'))
    expect(ltx.prompt?.portFallback).toBe('value')
  })
})

describe('templateOverrides pin the heuristic result', () => {
  it('matches the heuristic result for every curated id', () => {
    for (const id of curatedIds) {
      const roles = resolveRoles(loadTemplateWorkflow(id))
      const pin = templateOverrides[id]
      expect(pin.promptNodeId).toBe(roles.prompt?.innerNodeId)
      expect(pin.engineNodeId).toBe(roles.engine?.nodeId)
      expect(pin.sinkNodeId).toBe(roles.sink?.nodeId)
      expect(pin.mediaKind).toBe(roles.mediaKind)
      if (roles.source) expect(pin.sourceNodeId).toBe(roles.source.nodeId)
    }
  })

  it('override ids win over what the heuristics resolve on the graph', () => {
    // Feed a curated id against a graph whose own heuristics resolve to
    // different ids (sink 900, no prompt) — the pinned override must win, and
    // the null heuristic prompt exercises applyOverride's fallback branch.
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
    expect(roles.prompt?.innerNodeId).toBe(pin.promptNodeId)
    expect(roles.prompt?.widgetName).toBe('text')
    expect(roles.sink?.nodeId).not.toBe(toNodeId(900))
    expect(roles.mediaKind).not.toBe('video')
  })

  it('ignores an unknown template id and falls back to heuristics', () => {
    const withUnknown = resolveRoles(
      loadTemplateWorkflow('image_z_image_turbo'),
      'not_a_real_template'
    )
    const heuristic = resolveRoles(loadTemplateWorkflow('image_z_image_turbo'))
    expect(withUnknown).toEqual(heuristic)
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
    const graph = fromWorkflowJson(loadTemplateWorkflow('image_z_image_turbo'))
    const subgraph = graph.subgraphs[0]
    const clip = subgraph.nodes.find((n) => n.id === toNodeId(27))
    const textInput = clip?.inputs.find((i) => i.name === 'text')

    expect(textInput?.origin).toEqual({ kind: 'boundary', slot: 0 })
  })

  it('flags the hosting subgraph node', () => {
    const graph = fromWorkflowJson(loadTemplateWorkflow('image_z_image_turbo'))
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
    const heuristic = resolveRoles(loadTemplateWorkflow('image_z_image_turbo'))
    for (const id of ['constructor', 'toString', 'hasOwnProperty']) {
      expect(
        resolveRoles(loadTemplateWorkflow('image_z_image_turbo'), id)
      ).toEqual(heuristic)
    }
  })
})
