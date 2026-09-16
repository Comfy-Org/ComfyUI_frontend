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

type DropErrorHandler = (error: unknown) => void

function clearAppDragOverNode(nodeId: number | string | undefined) {
  if (nodeId === undefined || app.dragOverNode?.id !== nodeId) return

  app.dragOverNode = null
  app.canvas.setDirty(false, true)
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

export function useVueNodeDragAndDrop(
  lgraphNode: Readonly<Ref<LGraphNode | null | undefined>>,
  onError: DropErrorHandler
) {
  const isDraggingOver = ref(false)
  let acceptedNodeId: number | string | undefined

  function clearDragOverState(nodeId = acceptedNodeId) {
    isDraggingOver.value = false
    acceptedNodeId = undefined
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
      acceptedNodeId = node.id
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
      clearDragOverState(node?.id)
      return
    }

    if (
      isUriOnlyDrop(event) ||
      app.dragOverNode?.id !== node.id ||
      node.onDragOver?.(event) !== true
    ) {
      clearDragOverState(node.id)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    app.dragOverNode = node

    try {
      if (await node.onDragDrop(event)) {
        markDropEventHandled(event)
      } else {
        clearAppDragOverNode(node.id)
        await app.handleFileDrop(event, { skipNodeRouting: true })
        markDropEventHandled(event)
      }
    } catch (error) {
      markDropEventHandled(event)
      clearAppDragOverNode(node.id)
      onError(error)
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
