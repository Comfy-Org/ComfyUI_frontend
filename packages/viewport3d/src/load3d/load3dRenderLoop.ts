type RenderLoopOptions = {
  tick: () => void
  isActive: () => boolean
}

export type RenderLoopHandle = {
  stop: () => void
  wake: () => void
}

export function startRenderLoop({
  tick,
  isActive
}: RenderLoopOptions): RenderLoopHandle {
  let frameId: number | null = null
  let stopped = false

  const loop = () => {
    frameId = null
    if (!isActive()) return
    frameId = requestAnimationFrame(loop)
    tick()
  }

  loop()

  return {
    stop() {
      stopped = true
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
        frameId = null
      }
    },
    wake() {
      if (stopped || frameId !== null) return
      frameId = requestAnimationFrame(loop)
    }
  }
}
