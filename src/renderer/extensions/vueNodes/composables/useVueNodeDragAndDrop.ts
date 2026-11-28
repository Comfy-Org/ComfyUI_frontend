import { ref } from 'vue'
import type { Ref } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useApp } from '@/scripts/appInstance'
import {
  getFilesFromItems,
  isSyntheticImageBmpPlaceholder,
  markDropEventHandled,
  URI_DROP_TYPES
} from '@/utils/eventUtils'

type DropErrorHandler = (error: unknown) => void

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
  const app = useApp()
  const isDraggingOver = ref(false)
  let acceptedNode: LGraphNode | undefined

  function clearAppDragOverNode(node: LGraphNode | undefined) {
    if (!node || app.dragOverNode !== node) return

    app.dragOverNode = null
    app.canvas.setDirty(false, true)
  }

  function clearDragOverState() {
    const node = acceptedNode ?? lgraphNode.value ?? undefined
    isDraggingOver.value = false
    acceptedNode = undefined
    clearAppDragOverNode(node)
  }

  function isAcceptedNodeDrop(event: DragEvent, node: LGraphNode): boolean {
    if (isUriOnlyDrop(event) || app.dragOverNode !== node) return false
    return node.onDragOver?.(event) === true
  }

  function handleDragOver(event: DragEvent) {
    const node = lgraphNode.value
    if (app.canvas.selectOnly || !node?.onDragOver) {
      clearDragOverState()
      return
    }

    const canDrop = node.onDragOver(event)
    isDraggingOver.value = canDrop

    if (canDrop) {
      acceptedNode = node
      app.dragOverNode = node
    } else {
      clearDragOverState()
    }
  }

  function handleDragLeave() {
    clearDragOverState()
  }

  async function handleDrop(event: DragEvent) {
    if (event.defaultPrevented) {
      clearDragOverState()
      app.dragOverNode = null
      markDropEventHandled(event)
      return
    }

    const node = lgraphNode.value
    if (app.canvas.selectOnly || !node?.onDragDrop) {
      clearDragOverState()
      return
    }

    if (!isAcceptedNodeDrop(event, node)) {
      clearDragOverState()
      return
    }

    event.preventDefault()
    event.stopPropagation()
    app.dragOverNode = node

    try {
      if (await node.onDragDrop(event)) {
        markDropEventHandled(event)
      } else {
        clearAppDragOverNode(node)
        await app.handleFileDrop(event, { skipNodeRouting: true })
        markDropEventHandled(event)
      }
    } catch (error) {
      markDropEventHandled(event)
      clearAppDragOverNode(node)
      onError(error)
    } finally {
      if (acceptedNode === node) clearDragOverState()
      else clearAppDragOverNode(node)
    }
  }

  return {
    isDraggingOver,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}
