import type { Transform } from '../node'
import type { Overlay } from '../tool'
import { handlePos } from './transformMath'
import type { HandleId } from './transformMath'

const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function addTransformBox(
  overlay: Overlay,
  t: Transform,
  handles = true
): void {
  const corners: HandleId[] = ['nw', 'ne', 'se', 'sw']
  overlay.add({
    type: 'polyline',
    points: corners.map((h) => handlePos(t, h)),
    closed: true
  })
  if (!handles) return
  overlay.add({ type: 'line', a: handlePos(t, 'n'), b: handlePos(t, 'rotate') })
  for (const h of HANDLES)
    overlay.add({
      type: 'handle',
      pos: handlePos(t, h),
      shape: 'square',
      id: h
    })
  overlay.add({
    type: 'handle',
    pos: handlePos(t, 'rotate'),
    shape: 'circle',
    id: 'rotate'
  })
}
