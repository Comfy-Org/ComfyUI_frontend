import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { GraphScopes } from '@/platform/nodeApi/v4/graphScopeHandle'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeHandle, NodeInit } from '@/platform/nodeApi/v4/types'
import { assertPatch, checkedPoint, checkedString } from './checkedArguments'
import type { EditRunner } from './editRunner'

/** The graph edits, taking anything a pack passes and checking it. */
export interface GraphEdits {
  addNode(graph: unknown, type: unknown, init?: unknown): NodeHandle | undefined
}

const MEMBER = 'addNode'

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
    addNode(graph, type, init) {
      const locate = scopes.locator(graph)
      if (!locate) throw invalidArgument(MEMBER, 'a graph handle', graph)
      const create = checkedNodeCreation(type, init)
      const target = locate()
      const node = target && create()
      if (!target || !node) return undefined
      runner.apply(target, () => target.add(node))
      return nodes.find(target, String(node.id))
    }
  }
}

/** Checks what a node is to be made from, and gives what makes it. */
export function checkedNodeCreation(type: unknown, init: unknown = {}) {
  const nodeType = checkedString(MEMBER, 'type', type)
  assertPatch(MEMBER, init, INIT_FIELDS)
  const title =
    init.title === undefined
      ? undefined
      : checkedString(MEMBER, 'title', init.title)
  const pos =
    init.position === undefined
      ? undefined
      : checkedPoint(MEMBER, 'position', init.position)
  return () => LiteGraph.createNode(nodeType, title, pos && { pos })
}
