import type { DragAndScaleState } from '@/lib/litegraph/src/DragAndScale'

export function isValidCameraState(value: unknown): value is DragAndScaleState {
  if (
    !value ||
    typeof value !== 'object' ||
    !('offset' in value) ||
    !('scale' in value) ||
    !Array.isArray(value.offset) ||
    value.offset.length !== 2
  ) {
    return false
  }

  return (
    typeof value.offset[0] === 'number' &&
    Number.isFinite(value.offset[0]) &&
    typeof value.offset[1] === 'number' &&
    Number.isFinite(value.offset[1]) &&
    typeof value.scale === 'number' &&
    Number.isFinite(value.scale) &&
    value.scale > 0
  )
}
