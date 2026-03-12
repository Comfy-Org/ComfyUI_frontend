import { describe, expect, it } from 'vitest'

import {
  LGraph,
  LGraphEventMode,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'

import { ExecutableGroupNodeDTO } from './executableGroupNodeDto'

describe('ExecutableGroupNodeDTO muted output resolution', () => {
  it('returns undefined when node mode is NEVER', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Muted Group')
    node.addOutput('out', 'number')
    node.mode = LGraphEventMode.NEVER
    graph.add(node)

    const dto = new ExecutableGroupNodeDTO(node, [], new Map(), undefined)
    const result = dto.resolveOutput(0, 'number', new Set())
    expect(result).toBeUndefined()
  })
})
