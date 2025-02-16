import type { LGraphNode } from '@comfyorg/litegraph'

import { api } from '@/scripts/api'
import { useToastStore } from '@/stores/toastStore'

import { useNodeDragAndDrop } from './useNodeDragAndDrop'
import { useNodePaste } from './useNodePaste'

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp'
const PASTED_IMAGE_EXPIRY_MS = 2000

const createFileInput = () => {
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = ACCEPTED_IMAGE_TYPES
  return fileInput
}

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
}

export const useNodeImageUpload = (
  node: LGraphNode,
  options: ImageUploadOptions
) => {
  const { fileFilter = () => true, onUploadComplete } = options

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

  // Handle drag & drop
  useNodeDragAndDrop(node, {
    fileFilter,
    onDrop: async (files) => {
      const paths = await Promise.all(files.map(handleUpload))
      const validPaths = paths.filter((p): p is string => !!p)
      if (validPaths.length) {
        onUploadComplete(validPaths)
      }
      return validPaths
    }
  })

  // Handle paste
  useNodePaste(node, {
    fileFilter,
    onPaste: async (file) => {
      const path = await handleUpload(file)
      if (path) {
        onUploadComplete([path])
      }
      return path
    }
  })

  // Handle file input
  const fileInput = createFileInput()
  fileInput.onchange = async () => {
    if (fileInput.files?.length) {
      const paths = await Promise.all(
        Array.from(fileInput.files).filter(fileFilter).map(handleUpload)
      )
      const validPaths = paths.filter((p): p is string => !!p)
      if (validPaths.length) {
        onUploadComplete(validPaths)
      }
    }
  }
  document.body.append(fileInput)

  return {
    fileInput,
    handleUpload
  }
}
