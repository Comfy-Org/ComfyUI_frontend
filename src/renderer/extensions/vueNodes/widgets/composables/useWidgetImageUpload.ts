import { type ComputedRef, onMounted } from 'vue'

import { useNodeImageUpload } from '@/composables/node/useNodeImageUpload'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ResultItemType } from '@/schemas/apiSchema'

interface Params {
  nodeRef: ComputedRef<LGraphNode | undefined>
  allowBatch: ComputedRef<boolean>
  folder: ComputedRef<ResultItemType>
  accept?: string
  onUploaded: (paths: string[]) => void
}

/**
 * Thin wrapper around useNodeImageUpload tailored for a Vue widget.
 * Attaches upload behaviors to the node and exposes a simple open() trigger.
 */
export function useWidgetImageUpload({
  nodeRef,
  allowBatch,
  folder,
  accept,
  onUploaded
}: Params) {
  let openFileSelection: (() => void) | null = null

  onMounted(() => {
    const node = nodeRef.value
    if (!node) return
    const { openFileSelection: open } = useNodeImageUpload(node, {
      allow_batch: allowBatch.value,
      accept,
      folder: folder.value,
      fileFilter: (f) => f.type.startsWith('image/'),
      onUploadComplete: onUploaded
    })
    openFileSelection = open
  })

  return {
    open: () => openFileSelection?.()
  }
}
