type RenderLoopOptions = {
  tick: () => void
  isActive: () => boolean
}

export type RenderLoopHandle = {
  stop: () => void
}

export function startRenderLoop({
  tick,
  isActive
}: RenderLoopOptions): RenderLoopHandle {
  let frameId: number | null = null

  const loop = () => {
    frameId = requestAnimationFrame(loop)
    if (!isActive()) return
    tick()
  }

  loop()

  return {
    stop() {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
        frameId = null
      }
    }
  }
}
