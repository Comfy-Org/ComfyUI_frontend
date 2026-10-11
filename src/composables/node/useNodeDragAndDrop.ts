import { useChainCallback } from '@/composables/functional/useChainCallback'
import { partition } from 'es-toolkit'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'
import type { ResultItem } from '@/platform/remote/comfyui/execution/types'

type DragHandler = (e: DragEvent) => boolean
type DropHandler<T> = (files: File[]) => Promise<T[]>

interface DragAndDropOptions<T> {
  onDragOver?: DragHandler
  onDrop: DropHandler<T>
  onResultItemDrop?: (item: ResultItem) => void
  fileFilter?: (file: File) => boolean
  onReject?: (files: File[]) => boolean
}

/**
 * Adds drag and drop file handling to a node
 * Will also resolve 'text/uri-list' to a file before passing
 */
export const useNodeDragAndDrop = <T>(
  node: LGraphNode,
  options: DragAndDropOptions<T>
) => {
  const { onDragOver, onDrop, fileFilter = () => true } = options

  const hasFiles = (items: DataTransferItemList) =>
    !!Array.from(items).find((f) => f.kind === 'file')

  const filterFiles = (files: FileList | File[]) =>
    Array.from(files).filter(fileFilter)

  function handleRejectedFiles(files: File[]) {
    return files.length > 0 && (options.onReject?.(files) ?? false)
  }

  const isDraggingFiles = (e: DragEvent | undefined) => {
    if (!e?.dataTransfer?.items) return false
    return (
      onDragOver?.(e) ??
      (hasFiles(e.dataTransfer.items) ||
        e.dataTransfer.types.includes('text/uri-list'))
    )
  }

  const installedDragOver = isDraggingFiles
  node.onDragOver = installedDragOver

  const installedDragDrop = async function (e: DragEvent) {
    const { dataTransfer } = e
    if (!dataTransfer) return false

    const droppedFiles = Array.from(dataTransfer.files)
    const [files, rejectedFiles] = partition(droppedFiles, fileFilter)
    const rejectedFilesClaimed = handleRejectedFiles(rejectedFiles)
    if (files.length) {
      await onDrop(files)
      return true
    }
    if (dataTransfer.files.length) {
      return rejectedFilesClaimed
    }
    const asset = parseAssetInfo(dataTransfer)
    if (asset?.filename && options.onResultItemDrop) {
      await options.onResultItemDrop(asset)
      return true
    }

    const baseUri = dataTransfer.getData('text/uri-list')
    if (!baseUri) return false
    const uri = URL.parse(baseUri, location.href)
    if (!uri || uri.origin !== location.origin) return false

    try {
      const resp = await fetch(uri)
      const fileName =
        asset?.filename ??
        uri.searchParams.get('filename') ??
        baseUri.split('/').at(-1)
      if (!fileName || !resp.ok) return false

      const blob = await resp.blob()
      const file = new File([blob], fileName, { type: blob.type })
      const uriFiles = filterFiles([file])
      if (!uriFiles.length) {
        return handleRejectedFiles([file])
      }

      await onDrop(uriFiles)
    } catch {
      return false
    }
    return true
  }
  node.onDragDrop = installedDragDrop

  node.onRemoved = useChainCallback(node.onRemoved, () => {
    if (node.onDragOver === installedDragOver) node.onDragOver = undefined
    if (node.onDragDrop === installedDragDrop) node.onDragDrop = undefined
  })
}
