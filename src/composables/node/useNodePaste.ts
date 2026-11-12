import { useChainCallback } from '@/composables/functional/useChainCallback'
import { partition } from 'es-toolkit'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

type PasteHandler<T> = (files: File[]) => Promise<T>

interface NodePasteOptions<T> {
  onPaste: PasteHandler<T>
  fileFilter?: (file: File) => boolean
  allow_batch?: boolean
  onReject?: (files: File[]) => void
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
    const [filteredFiles, rejectedFiles] = partition(files, fileFilter)
    if (rejectedFiles.length) options.onReject?.(rejectedFiles)
    if (!filteredFiles.length) {
      return
    }

    const paste = allow_batch ? filteredFiles : filteredFiles.slice(0, 1)

    void onPaste(paste)
  }
  node.pasteFiles = installedPasteFiles

  node.onRemoved = useChainCallback(node.onRemoved, () => {
    if (node.pasteFiles === installedPasteFiles) node.pasteFiles = undefined
  })
}
