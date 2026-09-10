import { beforeEach, describe, expect, it } from 'vitest'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { createAgentLayoutPort } from '@/renderer/core/layout/agentLayoutPort'

const scope = {
  rootGraphId: toRootGraphId('11111111-1111-4111-8111-111111111111'),
  owningGraphId: toOwningGraphId('11111111-1111-4111-8111-111111111111')
}
const context: RemoteMutationContext = {
  source: 'agent-remote',
  actor: 'agent:test',
  opId: 'op-1'
}
const nodeA = toNodeId(1)
const nodeB = toNodeId(2)

function layoutOf(nodeId: ReturnType<typeof toNodeId>) {
  const layout = layoutStore.getNodeLayout(scope.rootGraphId, nodeId)
  return layout && { position: layout.position, zIndex: layout.zIndex }
}

describe('createAgentLayoutPort', () => {
  const port = createAgentLayoutPort(layoutStore)

  beforeEach(() => {
    port.deleteNodes(scope, [nodeA, nodeB], context)
  })

  it('restores a replaced layout, which a bare create cannot', () => {
    port.createNode(
      scope,
      nodeA,
      { position: { x: 10, y: 20 }, size: { width: 200, height: 100 } },
      context
    )
    const original = layoutOf(nodeA)

    const { captureNodes } = port
    if (!captureNodes) throw new Error('the agent layout port must capture')
    const capture = captureNodes(scope, [nodeA, nodeB])
    if (!capture) throw new Error('the agent layout port must capture')
    port.deleteNodes(scope, [nodeA], context)
    port.createNode(
      scope,
      nodeA,
      { position: { x: 900, y: 900 }, size: { width: 10, height: 10 } },
      context
    )
    port.createNode(
      scope,
      nodeB,
      { position: { x: 5, y: 5 }, size: { width: 10, height: 10 } },
      context
    )
    expect(layoutOf(nodeA)).not.toEqual(original)

    capture.restore(context)

    expect(layoutOf(nodeA)).toEqual(original)
    expect(layoutOf(nodeB)).toBeNull()
  })
})
