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
