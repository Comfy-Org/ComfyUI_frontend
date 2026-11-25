import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { GraphScopes } from '@/platform/nodeApi/v4/graphScopeHandle'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeHandle, NodeInit } from '@/platform/nodeApi/v4/types'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import { checkedPoint, checkedString } from './checkedArguments'
import type { EditRunner } from './editRunner'

export interface GraphEdits {
  /** `member` names the call a refusal blames, for a handle method that calls this. */
  addNode(
    graph: unknown,
    type: unknown,
    init?: unknown,
    member?: string
  ): NodeHandle | undefined
}

const INIT_FIELDS = {
  title: true,
  position: true
} satisfies Record<keyof NodeInit, true>

export function createGraphEdits(
  nodes: NodeHandles,
  scopes: GraphScopes,
  runner: EditRunner
): GraphEdits {
  return {
    addNode(graph, type, init, member = 'addNode') {
      const locate = scopes.locator(graph)
      if (!locate) throw invalidArgument(member, 'a graph handle', graph)
      const creation = checkedNodeCreation(member, type, init)
      const target = locate()
      if (!target || !creation.isRegistered()) return undefined
      const node = runner.apply(target, () => {
        const made = creation.create()
        if (made) target.add(made)
        return made
      })
      return node ? nodes.find(target, String(node.id)) : undefined
    }
  }
}

/** Checks what a node is to be made from, and gives whether its type is registered and what makes it. */
export function checkedNodeCreation(
  member: string,
  type: unknown,
  init: unknown = {}
) {
  const nodeType = checkedString(member, 'type', type)
  const { title: givenTitle, position } = checkedFields(
    member,
    'init',
    init,
    INIT_FIELDS
  )
  const title =
    givenTitle === undefined
      ? undefined
      : checkedString(member, 'title', givenTitle)
  const pos =
    position === undefined
      ? undefined
      : checkedPoint(member, 'position', position)
  return {
    isRegistered: () =>
      Object.hasOwn(LiteGraph.registered_node_types, nodeType),
    create: () =>
      LiteGraph.createNode(nodeType, title, {
        ...(title !== undefined && { title }),
        ...(pos && { pos })
      })
  }
}
