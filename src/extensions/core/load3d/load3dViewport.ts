type Size = { width: number; height: number }

type LetterboxedViewport = {
  offsetX: number
  offsetY: number
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

export function clientPointToLetterboxNdc(
  normalizedX: number,
  normalizedY: number,
  container: Size,
  targetAspectRatio: number | null
): { x: number; y: number } | null {
  if (targetAspectRatio === null) {
    return { x: normalizedX * 2 - 1, y: -(normalizedY * 2 - 1) }
  }
  const { offsetX, offsetY, width, height } = computeLetterboxedViewport(
    container,
    targetAspectRatio
  )
  if (width <= 0 || height <= 0) return null
  const localX = (normalizedX * container.width - offsetX) / width
  const localY = (normalizedY * container.height - offsetY) / height
  if (localX < 0 || localX > 1 || localY < 0 || localY > 1) return null
  return { x: localX * 2 - 1, y: -(localY * 2 - 1) }
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
