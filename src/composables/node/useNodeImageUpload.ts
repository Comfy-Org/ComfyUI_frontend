import { useNodeDragAndDrop } from '@/composables/node/useNodeDragAndDrop'
import { useNodeFileInput } from '@/composables/node/useNodeFileInput'
import { useNodePaste } from '@/composables/node/useNodePaste'
import { ServerFeatureFlag } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useToast } from '@/components/ui/toast'
import type { ResultItem } from '@/platform/remote/comfyui/execution/types'
import type { ResultItemType } from '@/schemas/resultItemTypeSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import { api } from '@/scripts/api'

const UPLOAD_TIMEOUT_MS = 120_000
const BYTES_PER_MB = 1024 * 1024

function buildUploadErrorMessage(resp: Response) {
  if (resp.status === 413) {
    const maxUploadSize = api.getServerFeature<number>(
      ServerFeatureFlag.MAX_UPLOAD_SIZE
    )
    return typeof maxUploadSize === 'number' && maxUploadSize > 0
      ? t('g.uploadFileTooLargeWithLimit', {
          limit: Math.round(maxUploadSize / BYTES_PER_MB)
        })
      : t('g.uploadFileTooLarge')
  }

  return t('g.uploadFailed', {
    reason: resp.statusText || `HTTP ${resp.status}`
  })
}

interface ImageUploadFormFields {
  /**
   * The folder to upload the file to.
   * @example 'input', 'output', 'temp'
   */
  type: ResultItemType
}

const uploadFile = async (
  file: File,
  formFields: Partial<ImageUploadFormFields> = {}
) => {
  const body = new FormData()
  body.append('image', file)
  if (formFields.type) body.append('type', formFields.type)

  const resp = await api.fetchApi('/upload/image', {
    method: 'POST',
    body,
    timeoutMs: UPLOAD_TIMEOUT_MS
  })

  if (resp.status !== 200) {
    useToast().warning('Alert', {
      description: buildUploadErrorMessage(resp)
    })
    return
  }

  const data = await resp.json()

  // Update AssetsStore input assets when files are uploaded to input folder
  if (formFields.type === 'input' || !formFields.type) {
    await useAssetsStore().inputAssets.invalidate()
  }

  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name
}

interface ImageUploadOptions {
  fileFilter?: (file: File) => boolean
  onUploadComplete: (paths: (string | ResultItem)[]) => void
  allow_batch?: boolean
  /**
   * The file types to accept.
   * @example 'image/png,image/jpeg,image/webp,video/webm,video/mp4'
   */
  accept?: string
  /**
   * The folder to upload the file to.
   * @example 'input', 'output', 'temp'
   */
  folder?: ResultItemType
  onUploadStart?: (files: File[]) => void
  onUploadError?: () => void
}

/**
 * Adds image upload to a node via drag & drop, paste, and file input.
 */
export const useNodeImageUpload = (
  node: LGraphNode,
  options: ImageUploadOptions
) => {
  const { fileFilter, onUploadComplete, allow_batch, accept } = options

  const handleUpload = async (file: File) => {
    try {
      const path = await uploadFile(file, {
        type: options.folder
      })
      if (!path) return
      return path
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        useToast().warning('Alert', { description: t('g.uploadTimedOut') })
      } else {
        useToast().warning('Alert', { description: String(error) })
      }
    }
  }

  const handleUploadBatch = async (files: File[]) => {
    if (node.isUploading) {
      useToast().warning('Alert', {
        description: t('g.uploadAlreadyInProgress')
      })
      return []
    }
    node.isUploading = true

    try {
      node.imgs = undefined
      node.graph?.setDirtyCanvas(true)
      options.onUploadStart?.(files)

      const paths = await Promise.all(files.map(handleUpload))
      const validPaths = paths.filter((p): p is string => !!p)
      if (validPaths.length) {
        onUploadComplete(validPaths)
      } else {
        options.onUploadError?.()
      }
      return validPaths
    } finally {
      node.isUploading = false
      node.graph?.setDirtyCanvas(true)
    }
  }

  // Handle drag & drop
  useNodeDragAndDrop(node, {
    fileFilter,
    onDrop: handleUploadBatch,
    onResultItemDrop: (item) => onUploadComplete([item])
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
