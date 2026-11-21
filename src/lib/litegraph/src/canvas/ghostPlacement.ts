import type { SerializedNodeId } from '@comfyorg/graph-model/nodeId'

interface GhostPlacementHost {
  readonly state: { readonly ghostNodeId: SerializedNodeId | null }
  finalizeGhostPlacement(cancelled: boolean): void
}

export function cancelGhostPlacement(canvas: GhostPlacementHost): void {
  if (canvas.state.ghostNodeId != null) canvas.finalizeGhostPlacement(true)
}
