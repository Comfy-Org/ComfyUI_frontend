import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import { useLiveGraphNode } from './useLiveGraphNode'

vi.mock(import('@/scripts/app'))

function configureRootGraph() {
  app.rootGraph.events.dispatch('configured')
}

describe(useLiveGraphNode, () => {
  it('resolves the node immediately', () => {
    const node = createMockLGraphNode({ id: 1 })
    const live = effectScope().run(() => useLiveGraphNode(() => node))

    expect(live?.value).toBe(node)
  })

  it('resolves again after the root graph is configured', () => {
    let current: LGraphNode | undefined = createMockLGraphNode({ id: 1 })
    const live = effectScope().run(() => useLiveGraphNode(() => current))

    const replacement = createMockLGraphNode({ id: 1 })
    current = replacement
    configureRootGraph()
    expect(live?.value).toBe(replacement)

    current = undefined
    configureRootGraph()
    expect(live?.value).toBeNull()
  })

  it('stops following the graph once its scope is disposed', () => {
    const original = createMockLGraphNode({ id: 1 })
    let current = original
    const scope = effectScope()
    const live = scope.run(() => useLiveGraphNode(() => current))

    scope.stop()
    current = createMockLGraphNode({ id: 1 })
    configureRootGraph()

    expect(live?.value).toBe(original)
  })
})
