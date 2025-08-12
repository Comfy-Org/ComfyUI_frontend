import { Reroute } from '../Reroute'
import type { CanvasColour, Point } from '../interfaces'

export interface RerouteSlotUiState {
  inputHover: boolean
  inputOutline: boolean
  outputHover: boolean
  outputOutline: boolean
}

const DEFAULT_REROUTE_COLOUR: CanvasColour = '#18184d'

export function drawReroute(
  ctx: CanvasRenderingContext2D,
  reroute: Reroute,
  backgroundPattern: CanvasPattern | undefined,
  colour: CanvasColour | undefined
): void {
  const { globalAlpha } = ctx
  const { pos } = reroute

  ctx.beginPath()
  ctx.arc(pos[0], pos[1], Reroute.radius, 0, 2 * Math.PI)

  if (reroute.linkIds.size === 0) {
    ctx.fillStyle = backgroundPattern ?? '#797979'
    ctx.fill()
    ctx.globalAlpha = globalAlpha * 0.33
  }

  ctx.fillStyle = colour ?? DEFAULT_REROUTE_COLOUR
  ctx.lineWidth = Reroute.radius * 0.1
  ctx.strokeStyle = 'rgb(0,0,0,0.5)'
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#ffffff55'
  ctx.strokeStyle = 'rgb(0,0,0,0.3)'
  ctx.beginPath()
  ctx.arc(pos[0], pos[1], Reroute.radius * 0.8, 0, 2 * Math.PI)
  ctx.fill()
  ctx.stroke()

  if (reroute.selected) {
    ctx.strokeStyle = '#fff'
    ctx.beginPath()
    ctx.arc(pos[0], pos[1], Reroute.radius * 1.2, 0, 2 * Math.PI)
    ctx.stroke()
  }

  ctx.globalAlpha = globalAlpha
}

export function drawRerouteHighlight(
  ctx: CanvasRenderingContext2D,
  reroute: Reroute,
  colour: CanvasColour
): void {
  const { pos } = reroute

  const { strokeStyle, lineWidth } = ctx
  ctx.strokeStyle = colour
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.arc(pos[0], pos[1], Reroute.radius * 1.5, 0, 2 * Math.PI)
  ctx.stroke()

  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
}

export function drawRerouteSlots(
  ctx: CanvasRenderingContext2D,
  reroute: Reroute,
  state: RerouteSlotUiState,
  colour: CanvasColour | undefined
): void {
  const c = colour ?? DEFAULT_REROUTE_COLOUR
  drawSlot(ctx, getInputPos(reroute), state.inputOutline, state.inputHover, c)
  drawSlot(
    ctx,
    getOutputPos(reroute),
    state.outputOutline,
    state.outputHover,
    c
  )
}

function drawSlot(
  ctx: CanvasRenderingContext2D,
  [x, y]: Point,
  showOutline: boolean,
  hovering: boolean,
  colour: CanvasColour
) {
  if (!showOutline) return
  const { fillStyle, strokeStyle, lineWidth } = ctx
  try {
    ctx.fillStyle = hovering ? colour : 'rgba(127,127,127,0.3)'
    ctx.strokeStyle = 'rgb(0,0,0,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(x, y, Reroute.slotRadius, 0, 2 * Math.PI)
    ctx.fill()
    ctx.stroke()
  } finally {
    ctx.fillStyle = fillStyle
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = lineWidth
  }
}

export function getInputPos(reroute: Reroute): Point {
  const [x, y] = reroute.pos
  return [x - Reroute.slotOffset, y]
}

export function getOutputPos(reroute: Reroute): Point {
  const [x, y] = reroute.pos
  return [x + Reroute.slotOffset, y]
}
