import type { NodeId } from '@/renderer/core/layout/types'
import { nodePresentationStore } from '@/renderer/core/nodePresentation/store/nodePresentationStore'
import type {
  NodePresentationState,
  PresentationSource
} from '@/renderer/core/nodePresentation/types'

interface NodePresentationActions {
  initializePresentation(nodeId: NodeId, state: NodePresentationState): void
  removePresentation(nodeId: NodeId): void
  updateTitle(nodeId: NodeId, title: string): void
  updateMode(nodeId: NodeId, mode: number): void
  updateShape(nodeId: NodeId, shape: number | undefined): void
  updateFlags(
    nodeId: NodeId,
    flags: Partial<NodePresentationState['flags']>
  ): void
  updateColors(nodeId: NodeId, color?: string, bgcolor?: string): void
  updateShowAdvanced(nodeId: NodeId, showAdvanced: boolean): void
  setSource(source: PresentationSource): void
}

export function useNodePresentationActions(): NodePresentationActions {
  function initializePresentation(
    nodeId: NodeId,
    state: NodePresentationState
  ): void {
    nodePresentationStore.initializeNode(nodeId, state)
  }

  function removePresentation(nodeId: NodeId): void {
    nodePresentationStore.removeNode(nodeId)
  }

  function updateTitle(nodeId: NodeId, title: string): void {
    nodePresentationStore.updateNode(nodeId, { title })
  }

  function updateMode(nodeId: NodeId, mode: number): void {
    nodePresentationStore.updateNode(nodeId, { mode })
  }

  function updateShape(nodeId: NodeId, shape: number | undefined): void {
    nodePresentationStore.updateNode(nodeId, { shape })
  }

  function updateFlags(
    nodeId: NodeId,
    flags: Partial<NodePresentationState['flags']>
  ): void {
    nodePresentationStore.updateNode(nodeId, { flags })
  }

  function updateColors(
    nodeId: NodeId,
    color?: string,
    bgcolor?: string
  ): void {
    nodePresentationStore.updateNode(nodeId, { color, bgcolor })
  }

  function updateShowAdvanced(nodeId: NodeId, showAdvanced: boolean): void {
    nodePresentationStore.updateNode(nodeId, { showAdvanced })
  }

  function setSource(source: PresentationSource): void {
    nodePresentationStore.setSource(source)
  }

  return {
    initializePresentation,
    removePresentation,
    updateTitle,
    updateMode,
    updateShape,
    updateFlags,
    updateColors,
    updateShowAdvanced,
    setSource
  }
}
