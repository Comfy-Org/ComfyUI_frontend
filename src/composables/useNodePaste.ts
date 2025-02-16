import type { LGraphNode } from '@comfyorg/litegraph'

type PasteHandler<T> = (file: File) => Promise<T>

interface NodePasteOptions<T> {
  onPaste: PasteHandler<T>
  fileFilter?: (file: File) => boolean
}

/**
 * Adds paste handling to a node
 */
export const useNodePaste = <T>(
  node: LGraphNode,
  options: NodePasteOptions<T>
) => {
  const { onPaste, fileFilter = () => true } = options

  node.pasteFile = function (file: File) {
    if (!fileFilter(file)) return false

    onPaste(file).then((result) => {
      if (!result) return
    })
    return true
  }
}
