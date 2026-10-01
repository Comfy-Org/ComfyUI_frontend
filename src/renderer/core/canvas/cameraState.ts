import type { DragAndScaleState } from '@/lib/litegraph/src/DragAndScale'

interface CameraScaleRange {
  readonly minScale: number
  readonly maxScale: number
}

const defaultScaleRange: CameraScaleRange = { minScale: 0.1, maxScale: 10 }

export function normalizeCameraState(
  value: unknown,
  { minScale, maxScale }: CameraScaleRange = defaultScaleRange
): DragAndScaleState | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('offset' in value) ||
    !('scale' in value) ||
    typeof value.offset !== 'object' ||
    value.offset === null
  ) {
    return null
  }

  if (
    '0' in value.offset &&
    '1' in value.offset &&
    typeof value.offset[0] === 'number' &&
    Number.isFinite(value.offset[0]) &&
    typeof value.offset[1] === 'number' &&
    Number.isFinite(value.offset[1]) &&
    typeof value.scale === 'number' &&
    Number.isFinite(value.scale) &&
    value.scale > 0
  ) {
    return {
      offset: [value.offset[0], value.offset[1]],
      scale: Math.min(Math.max(value.scale, minScale), maxScale)
    }
  }

  return null
}
