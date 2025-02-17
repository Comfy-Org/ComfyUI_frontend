interface FileInputOptions {
  accept?: string
  allow_batch?: boolean
  fileFilter?: (file: File) => boolean
  onSelect: (files: File[]) => void
}

/**
 * Creates a file input for a node.
 */
export function useNodeFileInput(options: FileInputOptions) {
  const {
    accept,
    allow_batch = false,
    fileFilter = () => true,
    onSelect
  } = options

  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = accept ?? '*'
  fileInput.multiple = allow_batch
  fileInput.style.visibility = 'hidden'

  fileInput.onchange = () => {
    if (fileInput.files?.length) {
      const files = Array.from(fileInput.files).filter(fileFilter)
      if (files.length) onSelect(files)
    }
  }

  document.body.append(fileInput)

  /**
   * Shows the system file picker dialog for selecting files.
   */
  function openFileSelection() {
    fileInput.click()
  }

  return {
    fileInput,
    openFileSelection
  }
}
