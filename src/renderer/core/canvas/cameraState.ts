import type { DragAndScaleState } from '@/lib/litegraph/src/DragAndScale'

interface CameraScaleRange {
  readonly minScale: number
  readonly maxScale: number
}

const defaultScaleRange: CameraScaleRange = { minScale: 0.1, maxScale: 10 }

export function isValidCameraState(
  value: unknown,
  { minScale, maxScale }: CameraScaleRange = defaultScaleRange
): value is DragAndScaleState {
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
    value.scale >= minScale &&
    value.scale <= maxScale
  )
}
