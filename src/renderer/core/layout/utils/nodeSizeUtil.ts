import { litegraph } from '@comfyorg/litegraph/litegraphInstance'

export const removeNodeTitleHeight = (height: number) =>
  Math.max(0, height - (litegraph().NODE_TITLE_HEIGHT || 0))
