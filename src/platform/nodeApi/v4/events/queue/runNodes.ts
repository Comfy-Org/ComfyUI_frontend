import type { NodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { getExecutionIdsForSelectedNodes } from '@/utils/graphTraversalUtil'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'

const RUN = 'queue.run'

/**
 * The execution ids `queue.run(options)` asks for, `undefined` for the whole
 * workflow, or `null` when a node it names is gone or cannot run.
 */
export function executionIdsToRun(
  options: unknown,
  nodes: NodeHandles
): NodeExecutionId[] | undefined | null {
  if (options === undefined) return undefined
  const { nodes: handles } = checkedFields(RUN, 'options', options, {
    nodes: true
  })
  if (handles === undefined) return undefined
  if (!Array.isArray(handles) || handles.length === 0) {
    throw invalidArgument(RUN, 'nodes as a list of node handles', handles)
  }
  const locators = handles.map((handle: unknown) => {
    const locate = nodes.locator(handle)
    if (!locate) throw invalidArgument(RUN, 'node handles', handle)
    return locate
  })
  const byGraph = new Map<LGraph, LGraphNode[]>()
  for (const locate of locators) {
    const live = locate()
    if (!live) return null
    const inGraph = byGraph.get(live.graph) ?? []
    inGraph.push(live.node)
    byGraph.set(live.graph, inGraph)
  }
  return executionIds(byGraph)
}

function executionIds(
  byGraph: ReadonlyMap<LGraph, LGraphNode[]>
): NodeExecutionId[] | null {
  const ids: NodeExecutionId[] = []
  for (const [graph, inGraph] of byGraph) {
    const placed = getExecutionIdsForSelectedNodes(inGraph, graph)
    if (placed.length === 0) return null
    ids.push(...placed)
  }
  return ids
}
