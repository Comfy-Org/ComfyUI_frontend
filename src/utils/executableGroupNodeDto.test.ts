import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  LGraph,
  LGraphNode,
  LGraphEventMode
} from '@/lib/litegraph/src/litegraph'

import { ExecutableGroupNodeDTO } from './executableGroupNodeDto'

describe('Muted group node output resolution', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('should return undefined for NEVER mode group nodes', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Muted Group')
    node.addOutput('out', 'IMAGE')
    node.mode = LGraphEventMode.NEVER
    graph.add(node)

    const dto = new ExecutableGroupNodeDTO(node, [], new Map(), undefined)
    const resolved = dto.resolveOutput(0, 'IMAGE', new Set())

    expect(resolved).toBeUndefined()
  })
})
