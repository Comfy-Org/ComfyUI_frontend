import { LiteGraph } from '@/lib/litegraph/src/litegraph'

export const removeNodeTitleHeight = (height: number) =>
  Math.max(0, height - (LiteGraph.NODE_TITLE_HEIGHT || 0))

export const getRenderedTitleHeight = (nodeElement: HTMLElement) =>
  nodeElement.dataset.noTitle === undefined ? LiteGraph.NODE_TITLE_HEIGHT : 0
