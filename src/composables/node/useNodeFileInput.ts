import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

interface FileInputOptions {
  accept?: string
  allow_batch?: boolean
  fileFilter?: (file: File) => boolean
  onSelect: (files: File[]) => void
}

/**
 * Creates a file input for a node.
 */
export function useNodeFileInput(node: LGraphNode, options: FileInputOptions) {
  const {
    accept,
    allow_batch = false,
    fileFilter = () => true,
    onSelect
  } = options

  let fileInput: HTMLInputElement | null = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = accept ?? '*'
  fileInput.multiple = allow_batch

  const handleChange = () => {
    if (fileInput?.files?.length) {
      const files = [...fileInput.files].filter(fileFilter)
      if (files.length) onSelect(files)
    }
  }
  fileInput.addEventListener('change', handleChange)

  node.onRemoved = useChainCallback(node.onRemoved, () => {
    if (fileInput) {
      fileInput.removeEventListener('change', handleChange)
      fileInput = null
    }
  })

  return {
    openFileSelection: () => fileInput?.click()
  }
}
