import type { Vec2 } from '../node'
import type { CanvasItem, Overlay } from '../tool'

export class OverlayList implements Overlay {
  items: CanvasItem[] = []
  private paused = 0

  constructor(private readonly onRedraw: () => void = () => {}) {}

  clear(): void {
    this.items = []
  }

  add(item: CanvasItem): void {
    this.items.push(item)
  }

  pause(): void {
    this.paused += 1
  }

  resume(): void {
    if (this.paused > 0) this.paused -= 1
    if (this.paused === 0) this.onRedraw()
  }

  hitHandle(pt: Vec2, screenTolerance: number): string | null {
    let best: string | null = null
    let bestD = screenTolerance
    for (const item of this.items) {
      if (item.type !== 'handle' || !item.id) continue
      const d = Math.hypot(pt.x - item.pos.x, pt.y - item.pos.y)
      if (d <= bestD) {
        bestD = d
        best = item.id
      }
    }
    return best
  }
}
