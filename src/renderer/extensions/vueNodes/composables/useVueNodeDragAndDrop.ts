import { ref } from 'vue'
import type { Ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import {
  getFilesFromItems,
  isSyntheticImageBmpPlaceholder,
  markDropEventHandled,
  URI_DROP_TYPES
} from '@/utils/eventUtils'

function clearAppDragOverNode(nodeId?: number | string) {
  if (
    app.dragOverNode &&
    (nodeId === undefined || app.dragOverNode.id === nodeId)
  ) {
    app.dragOverNode = null
    app.canvas.setDirty(false, true)
  }
}

function hasRealFileTransfer(event: DragEvent): boolean {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return false

  return (
    getFilesFromItems(dataTransfer.items).some(
      (file) => !isSyntheticImageBmpPlaceholder(file)
    ) ||
    Array.from(dataTransfer.files).some(
      (file) => !isSyntheticImageBmpPlaceholder(file)
    )
  )
}

function isUriOnlyDrop(event: DragEvent): boolean {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return false

  return (
    URI_DROP_TYPES.some((type) => dataTransfer.types.includes(type)) &&
    !hasRealFileTransfer(event)
  )
}

function getDragTransferSignature(event: DragEvent): string {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return ''

  const itemFiles = getFilesFromItems(dataTransfer.items)
  const files = Array.from(dataTransfer.files)
  const fileSignature = [...itemFiles, ...files]
    .map((file) => `${file.name}:${file.type}:${file.size}`)
    .join('|')
  return `${Array.from(dataTransfer.types).join('|')}::${fileSignature}`
}

export function useVueNodeDragAndDrop(
  lgraphNode: Readonly<Ref<LGraphNode | null | undefined>>
) {
  const isDraggingOver = ref(false)
  let acceptedDragSignature: string | null = null

  function clearDragOverState(nodeId?: number | string) {
    isDraggingOver.value = false
    acceptedDragSignature = null
    clearAppDragOverNode(nodeId)
  }

  function handleDragOver(event: DragEvent) {
    const node = lgraphNode.value
    if (!node?.onDragOver) {
      clearDragOverState(node?.id)
      return
    }

    const canDrop = node.onDragOver(event)
    isDraggingOver.value = canDrop

    if (canDrop) {
      acceptedDragSignature = getDragTransferSignature(event)
      app.dragOverNode = node
    } else {
      clearDragOverState(node.id)
    }
  }

  function handleDragLeave() {
    clearDragOverState(lgraphNode.value?.id)
  }

  async function handleDrop(event: DragEvent) {
    const node = lgraphNode.value
    if (!node?.onDragDrop) {
      isDraggingOver.value = false
      clearAppDragOverNode()
      return
    }

    const wasAcceptedDrag =
      getDragTransferSignature(event) === acceptedDragSignature
    const isAcceptedDrop = wasAcceptedDrag || node.onDragOver?.(event) === true

    if (
      isUriOnlyDrop(event) ||
      app.dragOverNode?.id !== node.id ||
      !isAcceptedDrop
    ) {
      clearDragOverState(node.id)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    markDropEventHandled(event)
    app.dragOverNode = node

    try {
      if (!(await node.onDragDrop(event))) {
        clearAppDragOverNode(node.id)
      }
    } finally {
      clearDragOverState(node.id)
    }
  }

  return {
    isDraggingOver,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}
