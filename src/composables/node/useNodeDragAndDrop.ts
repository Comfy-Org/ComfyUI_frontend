import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'
import type { ResultItem } from '@/schemas/apiSchema'
import {
  getFilesFromItems,
  isSyntheticImageBmpPlaceholder,
  URI_DROP_TYPES
} from '@/utils/eventUtils'

type DragHandler = (e: DragEvent) => boolean
type DropHandler<T> = (files: File[]) => Promise<T[]>

interface DragAndDropOptions<T> {
  onDragOver?: DragHandler
  onDrop: DropHandler<T>
  onResultItemDrop?: (item: ResultItem) => void
  fileFilter?: (file: File) => boolean
}

/**
 * Adds drag and drop file handling to a node
 * Will also resolve URI drops to a file before passing
 */
export const useNodeDragAndDrop = <T>(
  node: LGraphNode,
  options: DragAndDropOptions<T>
) => {
  const { onDragOver, onDrop, fileFilter = () => true } = options

  const filterFiles = (files: FileList | File[]) =>
    Array.from(files)
      .filter((file) => !isSyntheticImageBmpPlaceholder(file))
      .filter(fileFilter)

  const filterItemFiles = (items: DataTransferItemList) =>
    filterFiles(getFilesFromItems(items))

  const collectFiles = (e: DragEvent | undefined) => {
    const dataTransfer = e?.dataTransfer
    if (!dataTransfer) return []

    const files = filterFiles(dataTransfer.files)
    return files.length > 0 ? files : filterItemFiles(dataTransfer.items)
  }

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

    // Native OS drags may expose only opaque file items during dragover.
    // Keep hover affordance permissive here; drop remains strictly filtered.
    // This hover result must never be cached as authorization for the drop.
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
    if (!isDraggingValidFiles(e)) return false
    const { dataTransfer } = e
    if (!dataTransfer) return false

    const files = collectFiles(e)
    if (files.length) {
      await onDrop(files)
      return true
    }

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
        uri.searchParams.get('filename') ?? baseUri.split('/').at(-1)
      if (!fileName || !resp.ok) return false

      const blob = await resp.blob()
      const file = new File([blob], fileName, { type: blob.type })
      const uriFiles = filterFiles([file])
      if (!uriFiles.length) return false

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
