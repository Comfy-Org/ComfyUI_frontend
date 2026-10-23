import type { AppContext } from 'vue'
import { h, render } from 'vue'

import NodePreview from '@/components/node/NodePreview.vue'
import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

export function renderNodePreview(
  container: HTMLElement,
  nodeDef: ComfyNodeDefV2,
  appContext: AppContext
): () => void {
  const vnode = h(
    TooltipProvider,
    { disabled: true },
    { default: () => h(NodePreview, { nodeDef }) }
  )
  vnode.appContext = appContext
  render(vnode, container)
  return () => render(null, container)
}
