import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { zResultItem } from '@/schemas/apiSchema'
import type { ResultItem } from '@/schemas/apiSchema'

type DragHandler = (e: DragEvent) => boolean
type DropHandler<T> = (files: File[]) => Promise<T[]>

interface DragAndDropOptions<T> {
  onDragOver?: DragHandler
  onDrop: DropHandler<T>
  onResultItemDrop?: (item: ResultItem) => void
  fileFilter?: (file: File) => boolean
}

function parseAssetInfo(assetString?: string) {
  try {
    return zResultItem.safeParse(JSON.parse(assetString ?? '')).data
  } catch {
    // output was not parsable, allow fallthrough and return undefined
  }
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

  const hasValidFiles = (files: FileList) => filterFiles(files).length > 0

  const isDraggingFiles = (e: DragEvent | undefined) => {
    if (!e?.dataTransfer?.items) return false
    return (
      onDragOver?.(e) ??
      (hasFiles(e.dataTransfer.items) ||
        e?.dataTransfer?.types?.includes('text/uri-list'))
    )
  }

  const isDraggingValidFiles = (e: DragEvent | undefined) => {
    if (e?.dataTransfer?.files?.length)
      return hasValidFiles(e.dataTransfer.files)

    return !!e?.dataTransfer?.getData('text/uri-list')
  }

  const installedDragOver = isDraggingFiles
  node.onDragOver = installedDragOver

  const installedDragDrop = async function (e: DragEvent) {
    if (!isDraggingValidFiles(e)) return false

    const files = filterFiles(e.dataTransfer!.files)
    if (files.length) {
      await onDrop(files)
      return true
    }
    const asset = parseAssetInfo(e?.dataTransfer?.getData(MIME_ASSET_INFO))
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
