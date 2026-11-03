import { litegraph } from '@/lib/litegraph/src/litegraphInstance'

export const removeNodeTitleHeight = (height: number) =>
  Math.max(0, height - (litegraph().NODE_TITLE_HEIGHT || 0))

export const getRenderedTitleHeight = (nodeElement: HTMLElement) =>
  nodeElement.dataset.noTitle === undefined ? litegraph().NODE_TITLE_HEIGHT : 0
