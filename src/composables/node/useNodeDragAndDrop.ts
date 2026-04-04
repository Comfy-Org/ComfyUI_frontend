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
 * Will also resolve 'text/uri-list' to a file before passing
 */
export const useNodeDragAndDrop = <T>(
  node: LGraphNode,
  options: DragAndDropOptions<T>
) => {
  const { onDragOver, onDrop, fileFilter = () => true } = options

  const getFilesFromItems = (items: DataTransferItemList | undefined): File[] => {
    if (!items) return []
    return Array.from(items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file)
  }

  const hasFiles = (items: DataTransferItemList) =>
    !!Array.from(items).find((item) => item.kind === 'file')

  const filterFiles = (files: FileList | File[]) =>
    Array.from(files).filter(fileFilter)

  const filterItemFiles = (items: DataTransferItemList | undefined) =>
    getFilesFromItems(items).filter(fileFilter)

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
    if (e?.dataTransfer?.files?.length) {
      return hasValidFiles(e.dataTransfer.files)
    }

    if (e?.dataTransfer?.items?.length) {
      return filterItemFiles(e.dataTransfer.items).length > 0
    }

    return !!e?.dataTransfer?.getData('text/uri-list')
  }

  node.onDragOver = isDraggingFiles

  node.onDragDrop = async function (e: DragEvent) {
    console.log('useNodeDragAndDrop.onDragDrop:start', {
      nodeId: node.id,
      nodeType: node.type,
      files: Array.from(e.dataTransfer?.files ?? []).map((f) => ({
        name: f.name,
        type: f.type
      })),
      items: Array.from(e.dataTransfer?.items ?? []).map((i) => ({
        kind: i.kind,
        type: i.type,
        fileName: i.getAsFile?.()?.name ?? null
      })),
      uriList: e.dataTransfer?.getData('text/uri-list') ?? ''
    })

    const valid = isDraggingValidFiles(e)
    console.log('useNodeDragAndDrop.onDragDrop:valid', valid)
    if (!valid) return false

    let files = filterFiles(e.dataTransfer!.files)
    if (!files.length) {
      files = filterItemFiles(e.dataTransfer?.items)
    }

    if (files.length) {
      console.log(
        'useNodeDragAndDrop.onDragDrop:acceptedFiles',
        files.map((f) => ({
          name: f.name,
          type: f.type
        }))
      )
      await onDrop(files)
      return true
    }

    const uri = URL.parse(e?.dataTransfer?.getData('text/uri-list') ?? '')
    if (!uri || uri.origin !== location.origin) return false

    try {
      const resp = await fetch(uri)
      const fileName = uri?.searchParams?.get('filename')
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
}
