import { LiteGraph } from '@/lib/litegraph/src/litegraph'

export function removeNodeTitleHeight(height: number) {
  return Math.max(0, height - (LiteGraph.NODE_TITLE_HEIGHT || 0))
}
