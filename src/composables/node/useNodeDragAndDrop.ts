import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

type DragHandler = (e: DragEvent) => boolean
type DropHandler<T> = (files: File[]) => Promise<T[]>

interface DragAndDropOptions<T> {
  onDragOver?: DragHandler
  onDrop: DropHandler<T>
  fileFilter?: (file: File) => boolean
}

/**
 * Adds drag and drop file handling to a node
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

    return e?.dataTransfer?.getData('text/uri-list')
  }

  node.onDragOver = isDraggingFiles

  node.onDragDrop = async function (e: DragEvent) {
    if (!isDraggingValidFiles(e)) return false

    const files = filterFiles(e.dataTransfer!.files)
    if (files.length) {
      await onDrop(files)
      return true
    }

    const uri = e?.dataTransfer?.getData('text/uri-list')
    if (!uri) return false

    const resp = await fetch(uri)
    const fileName = URL.parse(uri)?.searchParams?.get('filename')
    if (!fileName) return false

    const blob = await resp.blob()
    const file = new File([blob], fileName, { type: blob.type })
    const uriFiles = filterFiles([file])
    if (!uriFiles.length) return false

    await onDrop([file])
    return true
  }
}
