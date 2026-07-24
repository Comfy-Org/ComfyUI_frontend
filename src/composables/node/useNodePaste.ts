import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

type PasteHandler<T> = (files: File[]) => Promise<T>

interface NodePasteOptions<T> {
  onPaste: PasteHandler<T>
  fileFilter?: (file: File) => boolean
  allow_batch?: boolean
}

/**
 * Adds paste handling to a node
 */
export const useNodePaste = <T>(
  node: LGraphNode,
  options: NodePasteOptions<T>
) => {
  const { onPaste, fileFilter = () => true, allow_batch = false } = options

  const installedPasteFiles = function (files: File[]) {
    const filteredFiles = Array.from(files).filter(fileFilter)
    if (!filteredFiles.length) return false

    const paste = allow_batch ? filteredFiles : filteredFiles.slice(0, 1)

    void onPaste(paste)
    return true
  }
  node.pasteFiles = installedPasteFiles

  node.onRemoved = useChainCallback(node.onRemoved, () => {
    if (node.pasteFiles === installedPasteFiles) node.pasteFiles = undefined
  })
}
