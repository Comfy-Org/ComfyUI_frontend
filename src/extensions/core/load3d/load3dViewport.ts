import { denormalize, normalize } from '@/utils/mathUtil'

type Size = { width: number; height: number }

export type LetterboxedViewport = {
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export type ViewportRect = {
  x: number
  y: number
  width: number
  height: number
}

export function computeLetterboxedViewport(
  container: Size,
  targetAspectRatio: number
): LetterboxedViewport {
  const containerAspectRatio = container.width / container.height

  if (containerAspectRatio > targetAspectRatio) {
    const height = container.height
    const width = height * targetAspectRatio
    return {
      offsetX: (container.width - width) / 2,
      offsetY: 0,
      width,
      height
    }
  }

  const width = container.width
  const height = width / targetAspectRatio
  return {
    offsetX: 0,
    offsetY: (container.height - height) / 2,
    width,
    height
  }
}

export type LetterboxNdc = { x: number; y: number; inside: boolean }

export type PointerNdcSource = (
  clientX: number,
  clientY: number
) => LetterboxNdc | null

export function clientPointToLetterboxNdc(
  normalizedX: number,
  normalizedY: number,
  container: Size,
  targetAspectRatio: number | null
): LetterboxNdc | null {
  const toNdc = (localX: number, localY: number): LetterboxNdc => ({
    x: denormalize(localX, -1, 1),
    y: -denormalize(localY, -1, 1),
    inside: localX >= 0 && localX <= 1 && localY >= 0 && localY <= 1
  })

  if (targetAspectRatio === null) {
    return toNdc(normalizedX, normalizedY)
  }
  const { offsetX, offsetY, width, height } = computeLetterboxedViewport(
    container,
    targetAspectRatio
  )
  if (width <= 0 || height <= 0) return null
  return toNdc(
    normalize(normalizedX * container.width, offsetX, offsetX + width),
    normalize(normalizedY * container.height, offsetY, offsetY + height)
  )
}

export function computeLetterboxBars(
  container: Size,
  viewport: LetterboxedViewport
): ViewportRect[] {
  if (viewport.offsetX >= 1) {
    return [
      { x: 0, y: 0, width: viewport.offsetX, height: container.height },
      {
        x: viewport.offsetX + viewport.width,
        y: 0,
        width: container.width - viewport.offsetX - viewport.width,
        height: container.height
      }
    ]
  }

  if (viewport.offsetY >= 1) {
    return [
      { x: 0, y: 0, width: container.width, height: viewport.offsetY },
      {
        x: 0,
        y: viewport.offsetY + viewport.height,
        width: container.width,
        height: container.height - viewport.offsetY - viewport.height
      }
    ]
  }

  return []
}

export type Load3dActivityFlags = {
  mouseOnNode: boolean
  mouseOnScene: boolean
  mouseOnViewer: boolean
  recording: boolean
  initialRenderDone: boolean
  animationPlaying: boolean
}

export function isLoad3dActive(flags: Load3dActivityFlags): boolean {
  return (
    flags.mouseOnNode ||
    flags.mouseOnScene ||
    flags.mouseOnViewer ||
    flags.recording ||
    !flags.initialRenderDone ||
    flags.animationPlaying
  )
}
