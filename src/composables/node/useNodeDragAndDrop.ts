import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { parseAssetInfo } from '@/platform/assets/schemas/mediaAssetSchema'
import type { ResultItem } from '@/schemas/apiSchema'
import {
  getFilesFromItems,
  isSyntheticImageBmpPlaceholder
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
 * Will also resolve 'text/uri-list' to a file before passing
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

  const filterItemFiles = (items: DataTransferItemList | undefined) =>
    filterFiles(getFilesFromItems(items))

  const hasFileItems = (items: DataTransferItemList | undefined) =>
    !!items && Array.from(items).some((item) => item.kind === 'file')

  const isDraggingFiles = (e: DragEvent | undefined) => {
    if (!e?.dataTransfer) return false

    const customDragOver = onDragOver?.(e)
    if (customDragOver !== undefined) return customDragOver

    if (filterFiles(e.dataTransfer.files).length > 0) {
      return true
    }

    const itemFiles = getFilesFromItems(e.dataTransfer.items).filter(
      (file) => !isSyntheticImageBmpPlaceholder(file)
    )
    if (itemFiles.length > 0) {
      return itemFiles.some(fileFilter)
    }

    // Native OS drags may expose only opaque file items during dragover.
    // Keep hover affordance permissive here; drop remains strictly filtered.
    return (
      hasFileItems(e.dataTransfer.items) ||
      e.dataTransfer.types.includes('text/uri-list')
    )
  }

  const isDraggingValidFiles = (e: DragEvent | undefined) => {
    const files = filterFiles(e?.dataTransfer?.files ?? [])
    if (files.length > 0) {
      return true
    }

    const itemFiles = filterItemFiles(e?.dataTransfer?.items)
    if (itemFiles.length > 0) {
      return true
    }

    return !!e?.dataTransfer?.getData('text/uri-list')
  }

  const installedDragOver = isDraggingFiles
  node.onDragOver = installedDragOver

  const installedDragDrop = async function (e: DragEvent) {
    const valid = isDraggingValidFiles(e)
    if (!valid) return false

    let files = filterFiles(e.dataTransfer?.files ?? [])
    if (!files.length) {
      files = filterItemFiles(e.dataTransfer?.items)
    }

    if (files.length) {
      await onDrop(files)
      return true
    }
    const asset = parseAssetInfo(e.dataTransfer!)
    if (asset?.filename && options.onResultItemDrop) {
      await options.onResultItemDrop(asset)
      return true
    }

    const baseUri = e?.dataTransfer?.getData('text/uri-list') ?? ''
    const uri = URL.parse(baseUri, location.href)
    if (!uri || uri.origin !== location.origin) return false

    try {
      const resp = await fetch(uri)
      const fileName =
        uri?.searchParams?.get('filename') ?? baseUri.split('/').at(-1)
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
