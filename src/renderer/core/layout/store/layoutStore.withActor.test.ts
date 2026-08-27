import { beforeEach, describe, expect, it } from 'vitest'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { LayoutChange } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'

const GRAPH = createUuidv4()

function createNodeOp(id: string) {
  return {
    type: 'createNode' as const,
    graphId: GRAPH,
    nodeId: toNodeId(id),
    layout: {
      id: toNodeId(id),
      position: { x: 0, y: 0 },
      size: { width: 100, height: 60 },
      zIndex: 0,
      visible: true,
      bounds: { x: 0, y: 0, width: 100, height: 60 }
    },
    timestamp: Date.now(),
    source: LayoutSource.Canvas
  }
}

async function deliveredChanges(apply: () => void): Promise<LayoutChange[]> {
  const changes: LayoutChange[] = []
  const unsubscribe = layoutStore.onChange((change) => changes.push(change))
  apply()
  await Promise.resolve()
  await Promise.resolve()
  unsubscribe()
  return changes
}

describe('layoutStore.withActor', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  it('stamps operations applied inside the scope with the scoped actor', async () => {
    const changes = await deliveredChanges(() => {
      layoutStore.withActor('agent-remote', () => {
        layoutStore.applyOperation(createNodeOp('1'))
      })
    })

    expect(changes).toHaveLength(1)
    expect(changes[0].operation.actor).toBe('agent-remote')
  })

  it('restores the session actor after the scope, including on throw', async () => {
    expect(() =>
      layoutStore.withActor('agent-remote', () => {
        throw new Error('boom')
      })
    ).toThrow('boom')

    const changes = await deliveredChanges(() => {
      layoutStore.applyOperation(createNodeOp('2'))
    })

    expect(changes).toHaveLength(1)
    expect(changes[0].operation.actor).toMatch(/^user-/)
  })

  it('rejects an async callback whose work would outlive the scope', async () => {
    expect(
      () => void layoutStore.withActor('agent-remote', async () => {})
    ).toThrow('synchronous callback')

    expect(
      () => void layoutStore.withActor('agent-remote', () => Promise.resolve(1))
    ).toThrow('synchronous callback')

    expect(
      () =>
        void layoutStore.withActor('agent-remote', () => ({ then: () => {} }))
    ).toThrow('synchronous callback')

    const changes = await deliveredChanges(() => {
      layoutStore.applyOperation(createNodeOp('9'))
    })

    expect(changes).toHaveLength(1)
    expect(changes[0].operation.actor).toMatch(/^user-/)
  })

  it('honours an actor already carried by the operation', async () => {
    const changes = await deliveredChanges(() => {
      layoutStore.withActor('agent-remote', () => {
        layoutStore.applyOperation({ ...createNodeOp('3'), actor: 'user-pre' })
      })
    })

    expect(changes).toHaveLength(1)
    expect(changes[0].operation.actor).toBe('user-pre')
  })
})
