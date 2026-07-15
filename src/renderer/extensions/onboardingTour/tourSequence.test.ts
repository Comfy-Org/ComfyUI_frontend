import { describe, expect, it } from 'vitest'

import { toNodeId } from '@/types/nodeId'

import type { ResolvedRoles } from './tourSequence'
import { sequenceBuilder, shapeOf } from './tourSequence'

function nodeRole(id: number) {
  return { nodeId: toNodeId(id) }
}

function promptRole(subgraphId: number, innerId: number) {
  return {
    subgraphNodeId: toNodeId(subgraphId),
    innerNodeId: toNodeId(innerId),
    widgetName: 'text',
    portFallback: 'prompt'
  }
}

const i2vRoles: ResolvedRoles = {
  source: nodeRole(97),
  prompt: promptRole(129, 93),
  engine: nodeRole(86),
  sink: nodeRole(108),
  mediaKind: 'video'
}

const t2iRoles: ResolvedRoles = {
  source: null,
  prompt: promptRole(57, 27),
  engine: nodeRole(3),
  sink: nodeRole(9),
  mediaKind: 'image'
}

describe('sequenceBuilder', () => {
  it('builds Upload → Prompt → Run → Result for an I2V graph', () => {
    const steps = sequenceBuilder(i2vRoles)

    expect(steps.map((s) => s.kind)).toEqual([
      'upload',
      'prompt',
      'run',
      'result'
    ])
  })

  it('omits the Upload step when there is no source (T2I)', () => {
    const steps = sequenceBuilder(t2iRoles)

    expect(steps.map((s) => s.kind)).toEqual(['prompt', 'run', 'result'])
  })

  it('targets the source node on the Upload step', () => {
    const upload = sequenceBuilder(i2vRoles).find((s) => s.kind === 'upload')

    expect(upload?.nodeId).toBe(toNodeId(97))
  })

  it('carries the prompt path on the Prompt step', () => {
    const prompt = sequenceBuilder(t2iRoles).find((s) => s.kind === 'prompt')

    expect(prompt?.prompt).toEqual(promptRole(57, 27))
  })

  it('carries the sink and media kind on the Result step', () => {
    const result = sequenceBuilder(i2vRoles).find((s) => s.kind === 'result')

    expect(result?.nodeId).toBe(toNodeId(108))
    expect(result?.mediaKind).toBe('video')
  })

  it('omits the Prompt step when the prompt role is unresolved', () => {
    const steps = sequenceBuilder({ ...t2iRoles, prompt: null })

    expect(steps.map((s) => s.kind)).toEqual(['run', 'result'])
  })

  it('omits the Result step when the sink role is unresolved', () => {
    const steps = sequenceBuilder({ ...t2iRoles, sink: null })

    expect(steps.map((s) => s.kind)).toEqual(['prompt', 'run'])
  })

  it('always includes the Run step, which targets no node', () => {
    const run = sequenceBuilder(t2iRoles).find((s) => s.kind === 'run')

    expect(run).toBeDefined()
    expect(run?.nodeId).toBeNull()
  })

  it('tags the Prompt and Upload steps with the shape that picks their copy', () => {
    const steps = sequenceBuilder(i2vRoles)

    expect(steps.find((s) => s.kind === 'upload')?.shape).toBe('i2v')
    expect(steps.find((s) => s.kind === 'prompt')?.shape).toBe('i2v')
  })
})

describe('shapeOf', () => {
  it('is t2i when nothing feeds the prompt', () => {
    expect(shapeOf(t2iRoles)).toBe('t2i')
  })

  it('is i2v when a source image drives video', () => {
    expect(shapeOf(i2vRoles)).toBe('i2v')
  })

  it('is image-edit when a source image drives an image', () => {
    // The prompt edits the picture rather than describing a new one, so this
    // must not collapse into t2i: the copy would tell the wrong story.
    expect(shapeOf({ ...i2vRoles, mediaKind: 'image' })).toBe('image-edit')
  })

  it('is other when the tour cannot tell what the workflow does', () => {
    expect(shapeOf({ ...t2iRoles, sink: null })).toBe('other')
    expect(shapeOf({ ...t2iRoles, prompt: null })).toBe('other')
  })
})
