interface GhostPlacementHost {
  finalizeGhostPlacement(cancelled: boolean): void
}

export function cancelGhostPlacement(canvas: GhostPlacementHost): void {
  canvas.finalizeGhostPlacement(true)
}
