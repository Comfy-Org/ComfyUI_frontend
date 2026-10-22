import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'
import type { ResultItem } from '@/platform/remote/comfyui/execution/types'
import {
  getFilesFromItems,
  isSyntheticImageBmpPlaceholder,
  URI_DROP_TYPES,
  withHdrImageType
} from '@/utils/eventUtils'

type DragHandler = (e: DragEvent) => boolean
type DropHandler<T> = (files: File[]) => Promise<T[]>

interface DragAndDropOptions<T> {
  onDragOver?: DragHandler
  onDrop: DropHandler<T>
  onResultItemDrop?: (item: ResultItem) => void
  fileFilter?: (file: File) => boolean
  onReject?: (files: File[]) => boolean
  canHandleRejectedFile?: (file: File) => boolean
}

/**
 * Adds drag and drop file handling to a node
 * Will also resolve URI drops to a file before passing
 */
export const useNodeDragAndDrop = <T>(
  node: LGraphNode,
  options: DragAndDropOptions<T>
) => {
  const {
    onDragOver,
    onDrop,
    fileFilter = () => true,
    onReject,
    canHandleRejectedFile
  } = options

  const filterFiles = (files: FileList | File[]) =>
    Array.from(files)
      .filter((file) => !isSyntheticImageBmpPlaceholder(file))
      .filter(fileFilter)

  const getDroppedFiles = (e: DragEvent | undefined): File[] => {
    const transfer = e?.dataTransfer
    if (!transfer) return []
    const files = Array.from(transfer.files).filter(
      (file) => !isSyntheticImageBmpPlaceholder(file)
    )
    const itemFiles = getFilesFromItems(transfer.items).filter(
      (file) => !isSyntheticImageBmpPlaceholder(file)
    )
    return (itemFiles.length > files.length ? itemFiles : files).map(
      withHdrImageType
    )
  }

  const collectFiles = (e: DragEvent | undefined) =>
    filterFiles(getDroppedFiles(e))

  const hasOpaqueFileItems = (items: DataTransferItemList) =>
    Array.from(items).some(
      (item) => item.kind === 'file' && item.getAsFile() === null
    )

  const getDropUri = (dataTransfer: DataTransfer) => {
    const uriType = URI_DROP_TYPES.find((type) =>
      dataTransfer.types.includes(type)
    )
    if (!uriType) return ''
    return dataTransfer.getData(uriType).split('\n').at(0)?.trim() ?? ''
  }

  const isDraggingFiles = (e: DragEvent | undefined) => {
    const dataTransfer = e?.dataTransfer
    if (!dataTransfer) return false

    const customDragOver = onDragOver?.(e)
    if (customDragOver !== undefined) return customDragOver

    if (collectFiles(e).length > 0) return true

    if (
      onReject &&
      canHandleRejectedFile &&
      getDroppedFiles(e).some(
        (file) => !fileFilter(file) && canHandleRejectedFile(file)
      )
    ) {
      return true
    }

    return (
      hasOpaqueFileItems(dataTransfer.items) ||
      URI_DROP_TYPES.some((type) => dataTransfer.types.includes(type))
    )
  }

  const isDraggingValidFiles = (e: DragEvent | undefined) => {
    const dataTransfer = e?.dataTransfer
    if (!dataTransfer) return false
    return collectFiles(e).length > 0 || !!getDropUri(dataTransfer)
  }

  const installedDragOver = isDraggingFiles
  node.onDragOver = installedDragOver

  const installedDragDrop = async function (e: DragEvent) {
    const { dataTransfer } = e
    if (!dataTransfer) return false

    const droppedFiles = getDroppedFiles(e)
    const files = filterFiles(droppedFiles)
    const rejectedFiles = droppedFiles.filter((file) => !fileFilter(file))
    const rejectedFilesClaimed =
      rejectedFiles.length > 0 && (options.onReject?.(rejectedFiles) ?? false)
    if (files.length) {
      await onDrop(files)
      return true
    }
    if (droppedFiles.length) return rejectedFilesClaimed
    if (!isDraggingValidFiles(e) && !parseAssetInfo(dataTransfer)?.filename)
      return false

    const asset = parseAssetInfo(dataTransfer)
    if (asset?.filename && options.onResultItemDrop) {
      await options.onResultItemDrop(asset)
      return true
    }

    const baseUri = getDropUri(dataTransfer)
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
        return options.onReject?.([file]) ?? false
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
