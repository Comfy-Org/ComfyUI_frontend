import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'

import type { ResolvedRoles } from './resolveTourRoles'
import { sequenceBuilder } from './tourSequence'

const SOURCE = toNodeId(97)
const PROMPT_HOST = toNodeId(129)
const SINK = toNodeId(108)

function roles(overrides: Partial<ResolvedRoles> = {}): ResolvedRoles {
  return {
    source: null,
    promptHost: null,
    sink: null,
    mediaKind: 'image',
    ...overrides
  }
}

describe('sequenceBuilder', () => {
  it.for([
    {
      shape: 'image to video',
      roles: roles({ source: SOURCE, promptHost: PROMPT_HOST, sink: SINK }),
      kinds: ['upload', 'prompt', 'run', 'result']
    },
    {
      shape: 'text to image',
      roles: roles({ promptHost: PROMPT_HOST, sink: SINK }),
      kinds: ['prompt', 'run', 'result']
    },
    {
      shape: 'no editable prompt',
      roles: roles({ source: SOURCE, sink: SINK }),
      kinds: ['upload', 'run', 'result']
    },
    {
      shape: 'nothing resolved',
      roles: roles(),
      kinds: ['run']
    }
  ])('omits the steps $shape cannot offer', ({ roles, kinds }) => {
    expect(sequenceBuilder(roles).map((step) => step.kind)).toEqual(kinds)
  })

  it('points each step at its own role', () => {
    const steps = sequenceBuilder(
      roles({ source: SOURCE, promptHost: PROMPT_HOST, sink: SINK })
    )

    expect(steps).toEqual([
      { kind: 'upload', nodeId: SOURCE },
      { kind: 'prompt', nodeId: PROMPT_HOST },
      { kind: 'run' },
      { kind: 'result', nodeId: SINK, mediaKind: 'image' }
    ])
  })

  it('hands the result step the sink and its media kind', () => {
    const steps = sequenceBuilder(
      roles({ promptHost: PROMPT_HOST, sink: SINK, mediaKind: 'video' })
    )

    expect(steps.at(-1)).toEqual({
      kind: 'result',
      nodeId: SINK,
      mediaKind: 'video'
    })
  })
})
