import type { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import { getCurrentInstance, h, render } from 'vue'

import NodePreview from '@/components/node/NodePreview.vue'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

type DragPreviewArgs = Parameters<
  NonNullable<Parameters<typeof draggable>[0]['onGenerateDragPreview']>
>[0]

/**
 * Renders a [[NodePreview]] under the cursor while the row is being dragged.
 * Returns an [[onGenerateDragPreview]] handler ready to pass to
 * [[usePragmaticDraggable]]; if [[resolveNodeDef]] yields null the browser's
 * default drag image is used.
 */
export function useNodePreviewDragImage(
  resolveNodeDef: () => ComfyNodeDefV2 | null
) {
  const appContext = getCurrentInstance()?.appContext ?? null

  return function onGenerateDragPreview({
    nativeSetDragImage
  }: DragPreviewArgs) {
    const nodeDef = resolveNodeDef()
    if (!nodeDef) return
    setCustomNativeDragPreview({
      nativeSetDragImage,
      render: ({ container }) => {
        const vnode = h(NodePreview, { nodeDef, position: 'relative' })
        if (appContext) vnode.appContext = appContext
        render(vnode, container)
        return () => {
          render(null, container)
        }
      }
    })
  }
}
