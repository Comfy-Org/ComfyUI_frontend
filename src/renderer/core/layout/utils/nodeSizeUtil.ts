import { litegraph } from '@/lib/litegraph/src/litegraphInstance'

export const removeNodeTitleHeight = (height: number) =>
  Math.max(0, height - (litegraph().NODE_TITLE_HEIGHT || 0))
