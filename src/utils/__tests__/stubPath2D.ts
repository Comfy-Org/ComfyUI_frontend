import { vi } from 'vitest'

/** Spy-backed stand-in for Path2D, which happy-dom does not implement. */
export class StubPath2D {
  readonly moveTo = vi.fn<Path2D['moveTo']>()
  readonly lineTo = vi.fn<Path2D['lineTo']>()
  readonly bezierCurveTo = vi.fn<Path2D['bezierCurveTo']>()
  readonly quadraticCurveTo = vi.fn<Path2D['quadraticCurveTo']>()
}

export function asStubPath(path: Path2D): StubPath2D {
  if (path instanceof StubPath2D) return path
  throw new TypeError('Expected the global Path2D test stub')
}
