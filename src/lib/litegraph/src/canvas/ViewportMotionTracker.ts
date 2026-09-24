import type { DragAndScale } from '../DragAndScale'

export const LINKS_RESTORE_DELAY_MS = 150

/**
 * Reports the viewport as moving from a pan or zoom until it has been still
 * for {@link LINKS_RESTORE_DELAY_MS}, then calls `onSettled` once.
 */
export class ViewportMotionTracker {
  enabled = false

  private movingUntil = 0
  private readonly last: [x: number, y: number, scale: number] = [
    Number.NaN,
    Number.NaN,
    Number.NaN
  ]
  private settleTimer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly onSettled: () => void) {}

  update({ offset, scale }: DragAndScale, now: number): void {
    const last = this.last
    const isFirstFrame = Number.isNaN(last[2])
    const moved =
      offset[0] !== last[0] || offset[1] !== last[1] || scale !== last[2]
    last[0] = offset[0]
    last[1] = offset[1]
    last[2] = scale
    if (!moved || isFirstFrame || !this.enabled) return

    this.movingUntil = now + LINKS_RESTORE_DELAY_MS
    clearTimeout(this.settleTimer)
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined
      this.onSettled()
    }, LINKS_RESTORE_DELAY_MS)
  }

  isMoving(now: number): boolean {
    return this.enabled && now < this.movingUntil
  }

  dispose(): void {
    clearTimeout(this.settleTimer)
    this.settleTimer = undefined
  }
}
