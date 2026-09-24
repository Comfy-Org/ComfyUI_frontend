export const AGENT_MINIMAP_ANIMATION_MS = 260
const MIN_MARKER_PX = 3
const HALO_PX = 5

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function agentMinimapGrowth(generatedAt: number, now: number): number {
  const progress = clamp01((now - generatedAt) / AGENT_MINIMAP_ANIMATION_MS)
  return 1 - (1 - progress) ** 3
}

export function drawAgentMinimapHighlight(
  ctx: CanvasRenderingContext2D,
  geometry: { x: number; y: number; width: number; height: number },
  growth: number
): void {
  const markerWidth = Math.max(geometry.width, MIN_MARKER_PX)
  const markerHeight = Math.max(geometry.height, MIN_MARKER_PX)
  const centerX = geometry.x + geometry.width / 2
  const centerY = geometry.y + geometry.height / 2
  const drawnWidth = markerWidth * (0.35 + 0.65 * growth)
  const drawnHeight = markerHeight * (0.35 + 0.65 * growth)

  ctx.fillRect(
    centerX - drawnWidth / 2,
    centerY - drawnHeight / 2,
    drawnWidth,
    drawnHeight
  )

  if (growth < 1) {
    const halo = HALO_PX * growth
    ctx.globalAlpha = 1 - growth
    ctx.strokeRect(
      centerX - drawnWidth / 2 - halo,
      centerY - drawnHeight / 2 - halo,
      drawnWidth + halo * 2,
      drawnHeight + halo * 2
    )
    ctx.globalAlpha = 1
  }
}
