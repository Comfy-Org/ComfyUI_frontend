import { Reroute } from '../Reroute'
import type { Point } from '../interfaces'
import type { RerouteSlotUiState } from './RerouteRenderer'

export function computeRerouteHoverState(
  reroute: Reroute,
  mouse: Point
): RerouteSlotUiState {
  const [mx, my] = mouse
  const state: RerouteSlotUiState = {
    inputHover: false,
    inputOutline: false,
    outputHover: false,
    outputOutline: false
  }

  const hasLink = reroute.firstLink != null
  const firstFloating = reroute.firstFloatingLink
  const showInput = hasLink || !!firstFloating?.isFloatingOutput
  const showOutput = hasLink || !!firstFloating?.isFloatingInput

  if (!showInput && !showOutput) return state

  const overBody = reroute.containsPoint([mx, my])

  if (showInput) {
    if (overBody) {
      state.inputOutline = true
    } else {
      const ix = reroute.pos[0] - Reroute.slotOffset
      const iy = reroute.pos[1]
      const dx = mx - ix
      const dy = my - iy
      const dist = Math.hypot(dx, dy)
      state.inputHover = dist <= 2 * Reroute.slotRadius
      state.inputOutline = dist <= 5 * Reroute.slotRadius
    }
  }

  if (showOutput) {
    if (overBody) {
      state.outputOutline = true
    } else {
      const ox = reroute.pos[0] + Reroute.slotOffset
      const oy = reroute.pos[1]
      const dx = mx - ox
      const dy = my - oy
      const dist = Math.hypot(dx, dy)
      state.outputHover = dist <= 2 * Reroute.slotRadius
      state.outputOutline = dist <= 5 * Reroute.slotRadius
    }
  }

  return state
}
