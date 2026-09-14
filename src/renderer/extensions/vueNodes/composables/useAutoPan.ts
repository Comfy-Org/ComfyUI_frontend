import { app } from '@/scripts/app'

const EDGE_PX = 48
const MAX_SPEED = 900

interface AutoPanState {
  active: boolean
  rafId: number | null
  lastTime: number
  velocityX: number
  velocityY: number
  lastClientX: number
  lastClientY: number
}

interface AutoPanControls {
  updatePointer: (clientX: number, clientY: number) => void
  stop: () => void
}

export function useAutoPan(
  onPan: (dxCanvas: number, dyCanvas: number) => void
): AutoPanControls {
  const state: AutoPanState = {
    active: false,
    rafId: null,
    lastTime: 0,
    velocityX: 0,
    velocityY: 0,
    lastClientX: 0,
    lastClientY: 0
  }

  function computeVelocity(clientX: number, clientY: number): [number, number] {
    const canvas = app.canvas?.canvas
    if (!canvas) return [0, 0]

    const rect = canvas.getBoundingClientRect()
    let vx = 0
    let vy = 0

    const distLeft = clientX - rect.left
    const distRight = rect.right - clientX
    const distTop = clientY - rect.top
    const distBottom = rect.bottom - clientY

    if (distLeft < EDGE_PX) vx = ((EDGE_PX - distLeft) / EDGE_PX) * MAX_SPEED
    else if (distRight < EDGE_PX)
      vx = -(((EDGE_PX - distRight) / EDGE_PX) * MAX_SPEED)

    if (distTop < EDGE_PX) vy = ((EDGE_PX - distTop) / EDGE_PX) * MAX_SPEED
    else if (distBottom < EDGE_PX)
      vy = -(((EDGE_PX - distBottom) / EDGE_PX) * MAX_SPEED)

    return [vx, vy]
  }

  function tick(timestamp: number): void {
    if (!state.active) return

    const [vx, vy] = computeVelocity(state.lastClientX, state.lastClientY)
    state.velocityX = vx
    state.velocityY = vy

    if (vx === 0 && vy === 0) {
      state.rafId = requestAnimationFrame(tick)
      return
    }

    const ds = app.canvas?.ds
    if (!ds) {
      stop()
      return
    }

    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.1)
    state.lastTime = timestamp

    const dxCanvas = (vx * dt) / ds.scale
    const dyCanvas = (vy * dt) / ds.scale

    ds.offset[0] += dxCanvas
    ds.offset[1] += dyCanvas
    app.canvas?.setDirty(true, true)

    onPan(dxCanvas, dyCanvas)

    state.rafId = requestAnimationFrame(tick)
  }

  function updatePointer(clientX: number, clientY: number): void {
    state.lastClientX = clientX
    state.lastClientY = clientY

    if (!state.active) {
      const [vx, vy] = computeVelocity(clientX, clientY)
      if (vx !== 0 || vy !== 0) {
        state.active = true
        state.lastTime = performance.now()
        state.rafId = requestAnimationFrame(tick)
      }
    }
  }

  function stop(): void {
    state.active = false
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId)
      state.rafId = null
    }
    state.velocityX = 0
    state.velocityY = 0
  }

  return { updatePointer, stop }
}
