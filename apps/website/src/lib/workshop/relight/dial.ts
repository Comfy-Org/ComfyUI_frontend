/**
 * The direction dial shows a directional light where it shines from, seen
 * from the camera: the centre is straight from the camera (elevation 90),
 * the inner ring is level with the photo (0) and the rim is behind it (-90).
 */
const degrees = (radians: number) => Math.round((radians * 180) / Math.PI) || 0
const radians = (value: number) => (value * Math.PI) / 180
const wrap = (direction: number) => ((direction + 540) % 360) - 180

/** Where a light sits on the dial, as a point in the unit circle. */
export function dialPoint(direction: number, elevation: number) {
  const reach = (90 - elevation) / 180
  return {
    x: -Math.cos(radians(direction)) * reach,
    y: -Math.sin(radians(direction)) * reach
  }
}

/** The light a point on the dial stands for; the centre keeps `direction`. */
export function fromDial(x: number, y: number, direction: number) {
  const reach = Math.min(1, Math.hypot(x, y))
  return {
    direction: reach < 0.02 ? direction : degrees(Math.atan2(-y, -x)),
    elevation: Math.round(90 - reach * 180)
  }
}

/** Arrow keys turn the light round the dial and raise or lower it. */
export function nudgeDial(
  direction: number,
  elevation: number,
  key: string,
  step = 5
) {
  const lift = (by: number) => Math.max(-90, Math.min(90, elevation + by))
  const moves: Partial<
    Record<string, { direction: number; elevation: number }>
  > = {
    ArrowLeft: { direction: wrap(direction - step), elevation },
    ArrowRight: { direction: wrap(direction + step), elevation },
    ArrowUp: { direction, elevation: lift(step) },
    ArrowDown: { direction, elevation: lift(-step) }
  }
  return moves[key]
}
