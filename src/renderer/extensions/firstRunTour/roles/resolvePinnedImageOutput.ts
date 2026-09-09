import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import { resolveNode } from '@/utils/litegraphUtil'

import { TOUR_ROLE_PINS } from './tourRolePins'

export function resolvePinnedImageOutput(
  graph: LGraph | undefined,
  templateId: string | undefined
) {
  const pins = Object.entries(TOUR_ROLE_PINS).find(
    ([id]) => id === templateId
  )?.[1]
  if (!graph || pins?.mediaKind !== 'image') return null
  const node = resolveNode(pins.sink.id, graph)
  return node?.type === pins.sink.type
    ? getExecutionIdByNode(graph, node)
    : null
}
