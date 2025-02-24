import type { LGraphNode } from '@comfyorg/litegraph'

import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import { useNodeFileInput } from '@/composables/node/useNodeFileInput'
import { useNodePaste } from '@/composables/node/useNodePaste'
import { api } from '@/scripts/api'
import { useToastStore } from '@/stores/toastStore'

const PASTED_IMAGE_EXPIRY_MS = 2000

const uploadFile = async (file: File, isPasted: boolean) => {
  const body = new FormData()
  body.append('image', file)
  if (isPasted) body.append('subfolder', 'pasted')

  const resp = await api.fetchApi('/upload/image', {
    method: 'POST',
    body
  })

  if (resp.status !== 200) {
    useToastStore().addAlert(resp.status + ' - ' + resp.statusText)
    return
  }

  const data = await resp.json()
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name
}

interface ImageUploadOptions {
  fileFilter?: (file: File) => boolean
  onUploadComplete: (paths: string[]) => void
  allow_batch?: boolean
  /**
   * The file types to accept.
   * @example 'image/png,image/jpeg,image/webp,video/webm,video/mp4'
   */
  accept?: string
}

/**
 * Adds image upload to a node via drag & drop, paste, and file input.
 */
export const useNodeImageUpload = (
  node: LGraphNode,
  options: ImageUploadOptions
) => {
  const { fileFilter, onUploadComplete, allow_batch, accept } = options

  const isPastedFile = (file: File): boolean =>
    file.name === 'image.png' &&
    file.lastModified - Date.now() < PASTED_IMAGE_EXPIRY_MS

  const handleUpload = async (file: File) => {
    try {
      const path = await uploadFile(file, isPastedFile(file))
      if (!path) return
      return path
    } catch (error) {
      useToastStore().addAlert(String(error))
    }
  }

  const handleUploadBatch = async (files: File[]) => {
    const paths = await Promise.all(files.map(handleUpload))
    const validPaths = paths.filter((p): p is string => !!p)
    if (validPaths.length) onUploadComplete(validPaths)
    return validPaths
  }

  // Handle drag & drop
  useNodeDragAndDrop(node, {
    fileFilter,
    onDrop: handleUploadBatch
  })

  // Handle paste
  useNodePaste(node, {
    fileFilter,
    allow_batch,
    onPaste: handleUploadBatch
  })

  // Handle file input
  const { openFileSelection } = useNodeFileInput(node, {
    fileFilter,
    allow_batch,
    accept,
    onSelect: handleUploadBatch
  })

  return { openFileSelection, handleUpload }
}
