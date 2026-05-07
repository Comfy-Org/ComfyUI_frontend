<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref } from 'vue'

type NodeId = 'n-green' | 'n-red' | 'n-blue' | 'n-purple' | 'n-output-ui'

type NodeBase = {
  x: number
  y: number
  w: number
  h: number
  ox: number
  oy: number
}

type ImageNode = NodeBase & {
  type: 'image'
  color: string
  rx: number
  img: HTMLImageElement
}

type PurpleNode = NodeBase & {
  type: 'purple'
  color: string
  rx: number
  img: HTMLImageElement
}

type SvgNode = NodeBase & {
  type: 'svg'
  img: HTMLImageElement
  progress: number
}

type NodeDef = ImageNode | PurpleNode | SvgNode

type ToggleEdgeId = 'canny-out' | 'depth-out'

type Edge = {
  id?: ToggleEdgeId
  src: NodeId
  sfx: number
  sfy: number
  tgt: NodeId
  tfx: number
  tfy: number
  togglable?: boolean
  connected?: boolean
}

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()

// Bounding box of the actual node content in scene coordinates. fitView
// scales this box to fit the container (with a small safety margin), so
// asymmetry here translates directly into where the cluster sits in the
// canvas. The bounds are tuned so each cluster edge has ~80 scene units of
// breathing room before the fit edge.
const CONTENT_MIN_X = 60
const CONTENT_MAX_X = 2055
const CONTENT_MIN_Y = 100
const CONTENT_MAX_Y = 1109
const CONTENT_W = CONTENT_MAX_X - CONTENT_MIN_X
const CONTENT_H = CONTENT_MAX_Y - CONTENT_MIN_Y
const CONTENT_CX = (CONTENT_MIN_X + CONTENT_MAX_X) / 2
const CONTENT_CY = (CONTENT_MIN_Y + CONTENT_MAX_Y) / 2

// At lg+ widths, HeroSection's text column maxes out at lg:max-w-xl (36rem)
// inside lg:p-16 (4rem) padding. Reserve that slice on the right so the
// cluster fits on the left without overlapping the headline / paragraph / CTA.
const TEXT_COLUMN_RESERVE_CSS = 640

const INK = '#211927'
const YELLOW = '#F2FF59'
const CANVAS_COLOR = '#C2BFB9'
const COOL_GRAY = '#3C3C3C'
const WARM_GRAY = '#7e7c78'
const SLOT_DOT_HIT_RADIUS = 26

const svgOutputRaw = `<svg width="386" height="116" viewBox="0 0 193 58" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="193" height="58" rx="16.3661" fill="#7E7C78"/>
<rect width="193" height="58" rx="16.3661" fill="black" fill-opacity="0.75"/>
<path d="M142.976 17.0794C141.15 17.0794 140.141 15.8487 140.141 14.1892V13.2363C140.141 11.5848 141.158 10.362 142.976 10.362C144.794 10.362 145.803 11.5848 145.803 13.2363V14.1892C145.803 15.8487 144.794 17.0794 142.976 17.0794ZM141.404 14.348C141.404 15.2373 141.864 15.9995 142.976 15.9995C144.08 15.9995 144.54 15.2373 144.54 14.348V13.0855C144.54 12.2121 144.08 11.4419 142.976 11.4419C141.864 11.4419 141.404 12.2121 141.404 13.0855V14.348ZM149.176 17.0794C147.373 17.0794 146.595 16.3489 146.595 14.6179V10.4414H147.842V14.7529C147.842 15.666 148.255 15.9995 149.176 15.9995C150.089 15.9995 150.502 15.666 150.502 14.7529V10.4414H151.748V14.6179C151.748 16.3648 150.97 17.0794 149.176 17.0794ZM154.275 17V11.5292H152.322V10.4414H157.475V11.5292H155.522V17H154.275ZM158.092 17V10.4414H161.006C162.538 10.4414 163.285 11.1004 163.285 12.6011V12.6805C163.285 14.1653 162.578 14.8482 161.006 14.8482H159.33V17H158.092ZM159.33 13.7922H161.03C161.744 13.7922 162.014 13.5063 162.014 12.8711V12.3947C162.014 11.7674 161.744 11.4895 161.03 11.4895H159.33V13.7922ZM166.524 17.0794C164.721 17.0794 163.943 16.3489 163.943 14.6179V10.4414H165.19V14.7529C165.19 15.666 165.603 15.9995 166.524 15.9995C167.437 15.9995 167.85 15.666 167.85 14.7529V10.4414H169.096V14.6179C169.096 16.3648 168.318 17.0794 166.524 17.0794ZM171.623 17V11.5292H169.67V10.4414H174.823V11.5292H172.87V17H171.623Z" fill="#C2BFB9"/>
<circle cx="179.214" cy="13.9834" r="1.9834" fill="#F2FF59"/>
<circle cx="13.7561" cy="14.4173" r="2.41727" fill="#F2FF59"/>
</svg>`

function makeImage(src: string, onload: () => void): HTMLImageElement {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  img.onload = onload
  return img
}

let imgGreen: HTMLImageElement
let imgRed: HTMLImageElement
let imgBlue: HTMLImageElement
let imgPurple: HTMLImageElement
let imgOutputSvg: HTMLImageElement

let nodes: Record<NodeId, NodeDef>
let edges: Edge[]

let vx = 0
let vy = 0
let vz = 1

let dragId: NodeId | null = null
let dragStart = { x: 0, y: 0 }
let dragOffStart = { x: 0, y: 0 }
let isSliding: NodeId | null = null

type SlotEnd = { edgeId: ToggleEdgeId; end: 'src' | 'tgt' }
// While the user is rewiring an edge, the slot they grabbed stays anchored
// — the wire pivots from that point — and the cursor controls the opposite
// end. Either side can initiate the drag (rip-off when connected, new wire
// when disconnected); dropping on a slot of the same edge reconnects, and
// dropping anywhere else disconnects.
let connectionDrag: {
  edgeId: ToggleEdgeId
  anchor: 'src' | 'tgt'
} | null = null
let connectionDragStart = { x: 0, y: 0 }
let dragCursorWorld = { x: 0, y: 0 }
let hoverSlot: SlotEnd | null = null

function absPos(id: NodeId) {
  const n = nodes[id]
  return { x: n.x + n.ox, y: n.y + n.oy, w: n.w, h: n.h }
}

function anchor(id: NodeId, fx: number, fy: number) {
  const p = absPos(id)
  return { x: p.x + p.w * fx, y: p.y + p.h * fy }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  color: string,
  img: HTMLImageElement,
  filter: string | null
) {
  ctx.save()
  if (filter) ctx.filter = filter
  ctx.beginPath()
  roundRect(ctx, x, y, w, h, rx)
  if (img && img.complete && img.naturalWidth !== 0) {
    ctx.clip()
    const aspectNode = w / h
    const aspectImg = img.naturalWidth / img.naturalHeight
    let drawW: number, drawH: number, drawX: number, drawY: number
    if (aspectImg > aspectNode) {
      drawH = h
      drawW = h * aspectImg
      drawX = x - (drawW - w) / 2
      drawY = y
    } else {
      drawW = w
      drawH = w / aspectImg
      drawX = x
      drawY = y - (drawH - h) / 2
    }
    ctx.drawImage(img, drawX, drawY, drawW, drawH)
  } else {
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.restore()
}

function levelsFilter(progress: number): string {
  // Map 0–1 slider to a levels effect:
  // 0.5 = identity, 0 = crushed shadows, 1 = blown highlights.
  const t = progress * 2 - 1
  const brightness = 1 + t * 0.9
  const contrast = 1 - Math.abs(t) * 0.3
  return `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)})`
}

function drawDepthBlur(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  img: HTMLImageElement,
  progress: number
) {
  if (!img || !img.complete || !img.naturalWidth) return

  const blurPx = progress * 20

  // Compose into a w×h offscreen canvas so blur overflow is clipped before
  // reaching the main canvas.
  const result = document.createElement('canvas')
  result.width = w
  result.height = h
  const rCtx = result.getContext('2d')
  if (!rCtx) return

  rCtx.drawImage(img, 0, 0, w, h)

  if (blurPx >= 0.4) {
    const pad = Math.ceil(blurPx * 2)
    const bCanvas = document.createElement('canvas')
    bCanvas.width = w + pad * 2
    bCanvas.height = h + pad * 2
    const bCtx = bCanvas.getContext('2d')
    if (bCtx) {
      bCtx.filter = `blur(${blurPx.toFixed(1)}px)`
      bCtx.drawImage(img, pad, pad, w, h)
      bCtx.filter = 'none'

      const cx = bCanvas.width * 0.5
      const cy = bCanvas.height * 0.38
      const innerR = Math.min(w, h) * 0.15 * (1 - progress * 0.4)
      const outerR = Math.max(w, h) * 0.85
      const grad = bCtx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(0.4, `rgba(0,0,0,${(progress * 0.5).toFixed(2)})`)
      grad.addColorStop(1, 'rgba(0,0,0,1)')
      bCtx.globalCompositeOperation = 'destination-in'
      bCtx.fillStyle = grad
      bCtx.fillRect(0, 0, bCanvas.width, bCanvas.height)

      rCtx.drawImage(bCanvas, -pad, -pad)
    }
  }

  ctx.save()
  roundRect(ctx, x, y, w, h, rx)
  ctx.clip()
  ctx.drawImage(result, x, y, w, h)
  ctx.restore()
}

function drawNode(ctx: CanvasRenderingContext2D, id: NodeId) {
  const n = nodes[id]
  const x = n.x + n.ox
  const y = n.y + n.oy

  ctx.save()

  if (n.type === 'purple') {
    const outputUi = nodes['n-output-ui'] as SvgNode
    const cannyOn = isEdgeConnected('canny-out')
    const depthOn = isEdgeConnected('depth-out')

    // Choose what the output card shows based on which inputs are wired in:
    //   both → final composed image (with depth-blur scrubber)
    //   one  → that single processed view, full-bleed, no scrub
    //   none → empty card placeholder
    if (cannyOn && depthOn) {
      drawDepthBlur(ctx, x, y, n.w, n.h, n.rx, n.img, outputUi.progress)
    } else if (cannyOn) {
      drawImageCover(ctx, x, y, n.w, n.h, n.rx, INK, imgRed, null)
    } else if (depthOn) {
      drawImageCover(ctx, x, y, n.w, n.h, n.rx, INK, imgBlue, null)
    } else {
      ctx.save()
      roundRect(ctx, x, y, n.w, n.h, n.rx)
      ctx.fillStyle = COOL_GRAY
      ctx.fill()
      ctx.restore()
    }

    const chipX = 24
    const chipW = 175
    const chipH = 44
    const chipR = 14
    const chip1Y = 42
    const chip2Y = 100
    const dotOffsetX = 18
    const dotR = 5
    const textOffsetX = 38

    const drawChip = (
      labelY: number,
      label: string,
      active: boolean,
      hovered: boolean
    ) => {
      // Soft yellow halo behind the chip when hovered — reads as "grab me".
      if (hovered) {
        ctx.save()
        roundRect(
          ctx,
          x + chipX - 4,
          y + labelY - 4,
          chipW + 8,
          chipH + 8,
          chipR + 4
        )
        ctx.fillStyle = 'rgba(242,255,89,0.18)'
        ctx.fill()
        ctx.restore()
      }

      roundRect(ctx, x + chipX, y + labelY, chipW, chipH, chipR)
      ctx.fillStyle = INK
      ctx.fill()

      // Hairline rim — disconnected chips show a dim warm-gray rim so the
      // click target still reads as a control even when off.
      ctx.save()
      roundRect(ctx, x + chipX, y + labelY, chipW, chipH, chipR)
      ctx.strokeStyle = active ? YELLOW : WARM_GRAY
      ctx.globalAlpha = hovered ? 0.95 : active ? 0.55 : 0.35
      ctx.lineWidth = hovered ? 1.5 : 1
      ctx.stroke()
      ctx.restore()

      const dotCenterX = x + chipX + dotOffsetX
      const dotCenterY = y + labelY + chipH / 2

      // Outer ring around the dot — same visual language as the source-side
      // slot ring so both ends advertise "this is a port".
      ctx.save()
      ctx.beginPath()
      ctx.arc(dotCenterX, dotCenterY, hovered ? 11 : 9, 0, Math.PI * 2)
      ctx.strokeStyle = active ? YELLOW : WARM_GRAY
      ctx.globalAlpha = hovered ? 0.9 : active ? 0.7 : 0.45
      ctx.lineWidth = hovered ? 2 : 1.4
      ctx.stroke()
      ctx.restore()

      // Solid dot.
      ctx.beginPath()
      ctx.arc(dotCenterX, dotCenterY, dotR, 0, Math.PI * 2)
      ctx.fillStyle = active ? YELLOW : WARM_GRAY
      ctx.fill()

      ctx.font = "800 14px 'PP Formula', sans-serif"
      ctx.fillStyle = active ? YELLOW : WARM_GRAY
      ctx.fillText(label, x + chipX + textOffsetX, y + labelY + chipH / 2 + 5)
    }

    const cannyHovered =
      hoverSlot?.edgeId === 'canny-out' && hoverSlot?.end === 'tgt'
    const depthHovered =
      hoverSlot?.edgeId === 'depth-out' && hoverSlot?.end === 'tgt'
    drawChip(chip1Y, 'CANNY EDGE', cannyOn, cannyHovered)
    drawChip(chip2Y, 'DEPTH MAP', depthOn, depthHovered)
  } else if (n.type === 'image') {
    const outputUi = nodes['n-output-ui'] as SvgNode
    const filter = id === 'n-blue' ? levelsFilter(outputUi.progress) : null
    drawImageCover(ctx, x, y, n.w, n.h, n.rx, n.color, n.img, filter)
  } else if (n.type === 'svg') {
    if (n.img && n.img.complete && n.img.naturalWidth !== 0) {
      ctx.drawImage(n.img, x, y, n.w, n.h)

      const sliderX = x + 16
      const sliderY = y + 64
      const sliderW = 355.6
      const sliderH = 13.2
      const sliderRX = 6.6

      roundRect(ctx, sliderX, sliderY, sliderW, sliderH, sliderRX)
      ctx.fillStyle = COOL_GRAY
      ctx.fill()

      const fillW = sliderW * n.progress
      if (fillW > 0) {
        ctx.save()
        roundRect(ctx, sliderX, sliderY, sliderW, sliderH, sliderRX)
        ctx.clip()
        ctx.fillStyle = CANVAS_COLOR
        ctx.fillRect(sliderX, sliderY, fillW, sliderH)
        ctx.restore()
      }
    }
  }

  ctx.restore()
}

function drawBezierWire(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  options: { dashed?: boolean; alpha?: number } = {}
) {
  const dx = bx - ax
  const cp1x = ax + dx * 0.5
  const cp1y = ay
  const cp2x = ax + dx * 0.5
  const cp2y = by

  ctx.save()
  ctx.strokeStyle = YELLOW
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  if (options.alpha !== undefined) ctx.globalAlpha = options.alpha
  if (options.dashed) ctx.setLineDash([10, 8])
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, bx, by)
  ctx.stroke()
  ctx.restore()
}

function drawEdge(ctx: CanvasRenderingContext2D, e: Edge) {
  if (e.connected === false) return
  // Hide the static line for the edge currently being dragged — the ghost
  // wire takes over while the user is rewiring.
  if (connectionDrag && connectionDrag.edgeId === e.id) return

  const a = anchor(e.src, e.sfx, e.sfy)
  const b = anchor(e.tgt, e.tfx, e.tfy)

  drawBezierWire(ctx, a.x, a.y, b.x, b.y)

  ctx.save()
  ctx.fillStyle = YELLOW
  ctx.beginPath()
  ctx.arc(a.x, a.y, 5.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(b.x, b.y, 5.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Visual indicator (ring + soft glow) that a slot is interactive.
// Source-side dots only — the target-side input lives inside a drawn chip,
// so its ring is rendered as part of the chip pass for correct stacking.
function drawSlotRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
  hovered: boolean
) {
  ctx.save()
  if (hovered) {
    // Soft outer halo on hover to read as "grab me"
    const halo = ctx.createRadialGradient(x, y, 4, x, y, 22)
    halo.addColorStop(0, 'rgba(242,255,89,0.45)')
    halo.addColorStop(1, 'rgba(242,255,89,0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(x, y, 22, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(x, y, hovered ? 12 : 10, 0, Math.PI * 2)
  ctx.strokeStyle = active ? YELLOW : WARM_GRAY
  ctx.globalAlpha = hovered ? 0.95 : active ? 0.75 : 0.55
  ctx.lineWidth = hovered ? 2.2 : 1.6
  ctx.stroke()
  ctx.restore()
}

function drawSlotIndicators(ctx: CanvasRenderingContext2D) {
  if (!edges) return
  for (const edge of edges) {
    if (!edge.id || !edge.togglable) continue
    const srcPos = anchor(edge.src, edge.sfx, edge.sfy)
    const isHovered = hoverSlot?.edgeId === edge.id && hoverSlot?.end === 'src'
    drawSlotRing(ctx, srcPos.x, srcPos.y, edge.connected !== false, isHovered)
  }
}

function drawConnectionDragGhost(ctx: CanvasRenderingContext2D) {
  if (!connectionDrag) return
  const edge = getEdge(connectionDrag.edgeId)
  if (!edge) return
  const anchorPos = edgeEndPos(edge, connectionDrag.anchor)

  // If the cursor is over a slot belonging to this edge, snap visually so
  // the user gets a "click target hit" cue before releasing.
  const snap =
    hoverSlot && hoverSlot.edgeId === connectionDrag.edgeId
      ? edgeEndPos(edge, hoverSlot.end)
      : dragCursorWorld

  drawBezierWire(ctx, anchorPos.x, anchorPos.y, snap.x, snap.y, {
    dashed: !hoverSlot || hoverSlot.edgeId !== connectionDrag.edgeId,
    alpha: 0.85
  })

  ctx.save()
  ctx.fillStyle = YELLOW
  ctx.beginPath()
  ctx.arc(anchorPos.x, anchorPos.y, 5.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(snap.x, snap.y, 5.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // Transparent background: the parent section paints the ink color, and the
  // text sits *behind* this canvas. Clearing (instead of filling) lets the
  // hero copy show through between the nodes.
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.setTransform(vz, 0, 0, vz, vx, vy)

  drawNode(ctx, 'n-green')
  drawNode(ctx, 'n-red')
  drawNode(ctx, 'n-blue')
  drawNode(ctx, 'n-purple')
  drawNode(ctx, 'n-output-ui')

  edges.forEach((e) => drawEdge(ctx, e))

  drawSlotIndicators(ctx)
  drawConnectionDragGhost(ctx)
}

function fitView() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const dpr = window.devicePixelRatio || 1
  const cssW = container.clientWidth
  const cssH = container.clientHeight

  if (cssW === 0 || cssH === 0) return

  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  // Fit the node bounding box (not the full world) into the container with a
  // small safety margin, and center it. This prevents wide/short heroes from
  // leaving huge empty gutters around the scene. From lg up, reserve the
  // right slice of the hero for the text column so the cluster initially
  // sits on the left half — drag still works across the full canvas because
  // canvas.width/height stay at full bleed.
  const rightReserveCss = cssW >= 1024 ? TEXT_COLUMN_RESERVE_CSS : 0
  const visibleW = cssW - rightReserveCss
  const z = Math.min(visibleW / CONTENT_W, cssH / CONTENT_H) * 0.92 * dpr
  vz = z
  vx = (visibleW * dpr) / 2 - CONTENT_CX * z
  vy = canvas.height / 2 - CONTENT_CY * z

  // Keep every node inside the newly-sized viewport so a resize can't strand
  // a previously-dragged node outside the visible area.
  if (nodes) {
    for (const id of Object.keys(nodes) as NodeId[]) {
      clampNodeOffset(id)
    }
  }

  draw()
}

// Clamp a node's drag offset (ox, oy) so its bounding box stays fully inside
// the visible canvas area — this is the "hard stop" that prevents nodes from
// being dragged off the edge of the hero.
function clampNodeOffset(id: NodeId) {
  const canvas = canvasRef.value
  if (!canvas || !nodes || vz <= 0) return
  const n = nodes[id]

  const xMinWorld = -vx / vz
  const xMaxWorld = (canvas.width - vx) / vz
  const yMinWorld = -vy / vz
  const yMaxWorld = (canvas.height - vy) / vz

  const minOx = xMinWorld - n.x
  const maxOx = xMaxWorld - n.x - n.w
  const minOy = yMinWorld - n.y
  const maxOy = yMaxWorld - n.y - n.h

  // If the viewport is too small to contain the node entirely, center it on
  // the available axis rather than producing an impossible clamp range.
  n.ox =
    maxOx < minOx ? (minOx + maxOx) / 2 : Math.min(maxOx, Math.max(minOx, n.ox))
  n.oy =
    maxOy < minOy ? (minOy + maxOy) / 2 : Math.min(maxOy, Math.max(minOy, n.oy))
}

function clientToWorld(cx: number, cy: number) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const px = (cx - rect.left) * dpr
  const py = (cy - rect.top) * dpr
  return { x: (px - vx) / vz, y: (py - vy) / vz }
}

function isEdgeConnected(id: ToggleEdgeId): boolean {
  const edge = edges?.find((e) => e.id === id)
  return edge?.connected !== false
}

// Slot hit-test that distinguishes which end was grabbed.
// Targets:
//   - tgt: CANNY EDGE / DEPTH MAP chip on the purple card (~175×44 each —
//     generous click target, sits exactly over the input slot dot)
//   - src: smaller output dot on the right edge of canny / depth
function hitTestSlotEnd(wx: number, wy: number): SlotEnd | null {
  if (nodes && nodes['n-purple']) {
    const p = absPos('n-purple')
    const chipX = p.x + 24
    const chipW = 175
    const chipH = 44
    if (wx >= chipX && wx <= chipX + chipW) {
      if (wy >= p.y + 42 && wy <= p.y + 42 + chipH) {
        return { edgeId: 'canny-out', end: 'tgt' }
      }
      if (wy >= p.y + 100 && wy <= p.y + 100 + chipH) {
        return { edgeId: 'depth-out', end: 'tgt' }
      }
    }
  }
  if (edges) {
    for (const edge of edges) {
      if (!edge.id || !edge.togglable) continue
      const a = anchor(edge.src, edge.sfx, edge.sfy)
      const dx = wx - a.x
      const dy = wy - a.y
      if (dx * dx + dy * dy < SLOT_DOT_HIT_RADIUS * SLOT_DOT_HIT_RADIUS) {
        return { edgeId: edge.id, end: 'src' }
      }
    }
  }
  return null
}

function getEdge(id: ToggleEdgeId): Edge | undefined {
  return edges?.find((e) => e.id === id)
}

// Either end of a togglable edge can initiate a drag. The wire pivots from
// the side that was grabbed — so grabbing the middle-node output keeps the
// wire attached to the output, and grabbing the final-node input keeps it
// attached to the input. Drop on the matching slot to reconnect, anywhere
// else to disconnect.
function isSlotGrabbable(_edge: Edge, _end: 'src' | 'tgt'): boolean {
  return true
}

// World-coord position of one end of an edge.
function edgeEndPos(edge: Edge, end: 'src' | 'tgt') {
  return end === 'src'
    ? anchor(edge.src, edge.sfx, edge.sfy)
    : anchor(edge.tgt, edge.tfx, edge.tfy)
}

function hitTest(wx: number, wy: number): NodeId | null {
  const order: NodeId[] = [
    'n-output-ui',
    'n-purple',
    'n-blue',
    'n-red',
    'n-green'
  ]
  for (const id of order) {
    const p = absPos(id)
    if (wx >= p.x && wx <= p.x + p.w && wy >= p.y && wy <= p.y + p.h) {
      return id
    }
  }
  return null
}

function updateSliderInfo(id: NodeId, wx: number) {
  const node = nodes[id]
  if (node.type !== 'svg') return
  const p = absPos(id)
  const sliderX = p.x + 16
  const sliderW = 355.6
  let val = (wx - sliderX) / sliderW
  val = Math.max(0, Math.min(1, val))
  node.progress = val
  draw()
}

function onPointerDown(e: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const w = clientToWorld(e.clientX, e.clientY)

  const slotHit = hitTestSlotEnd(w.x, w.y)
  if (slotHit) {
    const edge = getEdge(slotHit.edgeId)
    if (edge && isSlotGrabbable(edge, slotHit.end)) {
      connectionDrag = { edgeId: slotHit.edgeId, anchor: slotHit.end }
      connectionDragStart = w
      dragCursorWorld = w
      hoverSlot = slotHit
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
      draw()
      return
    }
    // Slot was hit but not grabbable (connected input chip). The chip is a
    // control surface, not a node grip — block node-drag from starting on
    // it, otherwise users would accidentally drag the whole final-output
    // card just by tapping a connected chip.
    return
  }

  const hit = hitTest(w.x, w.y)
  if (!hit) return

  if (hit === 'n-output-ui') {
    const p = absPos(hit)
    if (
      w.y >= p.y + 50 &&
      w.y <= p.y + 90 &&
      w.x >= p.x + 16 &&
      w.x <= p.x + 371
    ) {
      isSliding = hit
      updateSliderInfo(hit, w.x)
      canvas.setPointerCapture(e.pointerId)
      return
    }
  }

  dragId = hit
  dragStart = w
  dragOffStart = { x: nodes[hit].ox, y: nodes[hit].oy }
  canvas.setPointerCapture(e.pointerId)
  canvas.style.cursor = 'grabbing'
}

function onPointerMove(e: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  if (connectionDrag) {
    dragCursorWorld = clientToWorld(e.clientX, e.clientY)
    hoverSlot = hitTestSlotEnd(dragCursorWorld.x, dragCursorWorld.y)
    draw()
  } else if (isSliding) {
    const w = clientToWorld(e.clientX, e.clientY)
    updateSliderInfo(isSliding, w.x)
  } else if (dragId) {
    const w = clientToWorld(e.clientX, e.clientY)
    nodes[dragId].ox = dragOffStart.x + (w.x - dragStart.x)
    nodes[dragId].oy = dragOffStart.y + (w.y - dragStart.y)
    clampNodeOffset(dragId)
    draw()
  } else {
    const w = clientToWorld(e.clientX, e.clientY)
    const slot = hitTestSlotEnd(w.x, w.y)
    const slotEdge = slot ? getEdge(slot.edgeId) : undefined
    const grabbable = slot && slotEdge && isSlotGrabbable(slotEdge, slot.end)
    // Only consider the chip "hovered" when it's actually interactive — a
    // connected input chip stays static so users learn it isn't a handle.
    const visibleSlot: SlotEnd | null = grabbable ? slot : null
    const hoverChanged =
      (visibleSlot?.edgeId ?? null) !== (hoverSlot?.edgeId ?? null) ||
      (visibleSlot?.end ?? null) !== (hoverSlot?.end ?? null)
    hoverSlot = visibleSlot
    if (grabbable) canvas.style.cursor = 'grab'
    else canvas.style.cursor = hitTest(w.x, w.y) ? 'grab' : 'default'
    if (hoverChanged) draw()
  }
}

function onPointerUp(e: PointerEvent) {
  const canvas = canvasRef.value
  if (connectionDrag) {
    const w = clientToWorld(e.clientX, e.clientY)
    const dx = w.x - connectionDragStart.x
    const dy = w.y - connectionDragStart.y
    const moved = dx * dx + dy * dy > 100 // ~10 world units
    const edge = getEdge(connectionDrag.edgeId)
    if (edge) {
      if (!moved) {
        // Click without drag: simple toggle (accessibility / quick path).
        edge.connected = edge.connected === false ? true : false
      } else {
        // Drop on any slot of the same edge → reconnect; anywhere else → drop.
        const dropSlot = hitTestSlotEnd(w.x, w.y)
        edge.connected = !!dropSlot && dropSlot.edgeId === connectionDrag.edgeId
      }
    }
    connectionDrag = null
    hoverSlot = null
    if (canvas) canvas.style.cursor = 'default'
    draw()
    return
  }
  dragId = null
  isSliding = null
  if (canvas) canvas.style.cursor = 'default'
}

function defineNodes() {
  nodes = {
    'n-green': {
      x: 100,
      y: 400,
      w: 339,
      h: 409,
      ox: 0,
      oy: 0,
      type: 'image',
      color: '#15FF00',
      rx: 26,
      img: imgGreen
    },
    'n-red': {
      x: 850,
      y: 180,
      w: 339,
      h: 409,
      ox: 0,
      oy: 0,
      type: 'image',
      color: '#D62828',
      rx: 26,
      img: imgRed
    },
    'n-blue': {
      x: 850,
      y: 600,
      w: 339,
      h: 409,
      ox: 0,
      oy: 0,
      type: 'image',
      color: '#1EB3EE',
      rx: 26,
      img: imgBlue
    },
    'n-purple': {
      x: 1380,
      y: 245,
      w: 595,
      h: 718,
      ox: 0,
      oy: 0,
      type: 'purple',
      color: '#3C07F9',
      rx: 30,
      img: imgPurple
    },
    'n-output-ui': {
      x: 460,
      y: 596,
      w: 386,
      h: 116,
      ox: 0,
      oy: 0,
      type: 'svg',
      img: imgOutputSvg,
      progress: 0.466
    }
  }

  // Edge anchors are normalized (0–1) fractions of each node's box so they
  // track the node when dragged around the canvas.
  edges = [
    {
      src: 'n-green',
      sfx: (339 - 24) / 339,
      sfy: 42 / 409,
      tgt: 'n-red',
      tfx: 24 / 339,
      tfy: 24 / 409
    },
    {
      src: 'n-green',
      sfx: (339 - 24) / 339,
      sfy: (42 + 26) / 409,
      tgt: 'n-output-ui',
      tfx: 13.8 / 193,
      tfy: 14.4 / 58
    },
    {
      src: 'n-output-ui',
      sfx: 179.2 / 193,
      sfy: 14.0 / 58,
      tgt: 'n-blue',
      tfx: 24 / 339,
      tfy: 24 / 409
    },
    {
      id: 'canny-out',
      src: 'n-red',
      sfx: (339 - 24) / 339,
      sfy: 24 / 409,
      tgt: 'n-purple',
      tfx: 42 / 595,
      tfy: 64 / 718,
      togglable: true,
      connected: true
    },
    {
      id: 'depth-out',
      src: 'n-blue',
      sfx: (339 - 24) / 339,
      sfy: 24 / 409,
      tgt: 'n-purple',
      tfx: 42 / 595,
      tfy: 122 / 718,
      togglable: true,
      connected: true
    }
  ]
}

useResizeObserver(containerRef, () => {
  fitView()
})

onMounted(async () => {
  const onImgLoad = () => draw()

  imgGreen = makeImage('/images/hero/green-node.png', onImgLoad)
  imgRed = makeImage('/images/hero/red-node.png', onImgLoad)
  imgBlue = makeImage('/images/hero/blue-node.png', onImgLoad)
  imgPurple = makeImage('/images/hero/purple-node.png', onImgLoad)
  imgOutputSvg = makeImage(
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgOutputRaw),
    onImgLoad
  )

  defineNodes()

  try {
    if (document.fonts?.load) {
      await document.fonts.load("800 13px 'PP Formula'")
    }
  } catch {
    // Font load errors fall back to sans-serif; safe to ignore.
  }

  fitView()

  const canvas = canvasRef.value
  if (canvas) {
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
  }
})

onBeforeUnmount(() => {
  const canvas = canvasRef.value
  if (canvas) {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
  }
})
</script>

<template>
  <div ref="containerRef" class="relative size-full overflow-hidden">
    <canvas
      ref="canvasRef"
      class="block size-full touch-pan-y select-none"
      aria-hidden="true"
    />
  </div>
</template>
