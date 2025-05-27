import type { LGraphNode } from '@comfyorg/litegraph'

import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import { useNodeFileInput } from '@/composables/node/useNodeFileInput'
import { useNodePaste } from '@/composables/node/useNodePaste'
import { api } from '@/scripts/api'
import { useToastStore } from '@/stores/toastStore'

const PASTED_IMAGE_EXPIRY_MS = 2000

const uploadFile = async (
  file: File,
  isPasted: boolean,
  folder: string = 'input'
) => {
  const body = new FormData()
  body.append('image', file)
  if (isPasted) body.append('subfolder', 'pasted')
  body.append('type', folder) // 使用 folder 参数

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
  folder?: string
}

/**
 * Adds image upload to a node via drag & drop, paste, and file input.
 */
export const useNodeImageUpload = (
  node: LGraphNode,
  options: ImageUploadOptions
) => {
  const {
    fileFilter,
    onUploadComplete,
    allow_batch,
    accept,
    folder = 'input'
  } = options
  console.log('[useNodeImageUpload] folder 参数:', folder)

  const isPastedFile = (file: File): boolean =>
    file.name === 'image.png' &&
    file.lastModified - Date.now() < PASTED_IMAGE_EXPIRY_MS

  const handleUpload = async (file: File) => {
    try {
      const path = await uploadFile(file, isPastedFile(file), folder)
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
