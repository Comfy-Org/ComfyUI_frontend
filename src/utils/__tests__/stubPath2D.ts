import { vi } from 'vitest'

class RecordedPath2D implements Pick<
  Path2D,
  'moveTo' | 'lineTo' | 'bezierCurveTo' | 'quadraticCurveTo'
> {
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  quadraticCurveTo(): void {}
}

/** Spied stand-in for Path2D, which happy-dom does not implement. */
export const StubPath2D = vi.mockObject(RecordedPath2D, { spy: true })
