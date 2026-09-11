import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { ExecutionOutputSelector } from '@/platform/execution/executionLifecycle'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import { resolveNode } from '@/utils/litegraphUtil'

import { TOUR_ROLE_PINS } from './tourRolePins'

export function resolvePinnedImageOutput(
  graph: LGraph | undefined,
  templateId: string | undefined
): ExecutionOutputSelector | null {
  const pins = Object.entries(TOUR_ROLE_PINS).find(
    ([id]) => id === templateId
  )?.[1]
  if (!graph || pins?.mediaKind !== 'image') return null
  const node = resolveNode(pins.sink.id, graph)
  if (node?.type !== pins.sink.type) return null
  const nodeId = getExecutionIdByNode(graph, node)
  return nodeId ? { nodeId, nodeType: pins.sink.type } : null
}
