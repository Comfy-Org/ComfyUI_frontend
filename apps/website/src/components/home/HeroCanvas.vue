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

type Edge = {
  src: NodeId
  sfx: number
  sfy: number
  tgt: NodeId
  tfx: number
  tfy: number
}

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()

// Bounding box of the actual node content in scene coordinates
// (x: 100–2045, y: 100–1059). fitView scales this box — not the outer
// 2150×1260 world — so nodes fill the container instead of stranding empty
// margins around them on wide heroes.
const CONTENT_MIN_X = 100
const CONTENT_MAX_X = 2045
const CONTENT_MIN_Y = 100
const CONTENT_MAX_Y = 1059
const CONTENT_W = CONTENT_MAX_X - CONTENT_MIN_X
const CONTENT_H = CONTENT_MAX_Y - CONTENT_MIN_Y
const CONTENT_CX = (CONTENT_MIN_X + CONTENT_MAX_X) / 2
const CONTENT_CY = (CONTENT_MIN_Y + CONTENT_MAX_Y) / 2

const INK = '#211927'
const YELLOW = '#F2FF59'
const CANVAS_COLOR = '#C2BFB9'
const COOL_GRAY = '#3C3C3C'

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
    drawDepthBlur(ctx, x, y, n.w, n.h, n.rx, n.img, outputUi.progress)

    const chipX = 24
    const chipW = 175
    const chipH = 44
    const chipR = 14
    const chip1Y = 42
    const chip2Y = 100
    const dotOffsetX = 18
    const dotR = 5
    const textOffsetX = 38

    roundRect(ctx, x + chipX, y + chip1Y, chipW, chipH, chipR)
    ctx.fillStyle = INK
    ctx.fill()

    ctx.beginPath()
    ctx.arc(
      x + chipX + dotOffsetX,
      y + chip1Y + chipH / 2,
      dotR,
      0,
      Math.PI * 2
    )
    ctx.fillStyle = YELLOW
    ctx.fill()

    ctx.font = "800 14px 'PP Formula', sans-serif"
    ctx.fillStyle = YELLOW
    ctx.fillText(
      'CANNY EDGE',
      x + chipX + textOffsetX,
      y + chip1Y + chipH / 2 + 5
    )

    roundRect(ctx, x + chipX, y + chip2Y, chipW, chipH, chipR)
    ctx.fillStyle = INK
    ctx.fill()

    ctx.beginPath()
    ctx.arc(
      x + chipX + dotOffsetX,
      y + chip2Y + chipH / 2,
      dotR,
      0,
      Math.PI * 2
    )
    ctx.fillStyle = YELLOW
    ctx.fill()

    ctx.font = "800 14px 'PP Formula', sans-serif"
    ctx.fillStyle = YELLOW
    ctx.fillText(
      'DEPTH MAP',
      x + chipX + textOffsetX,
      y + chip2Y + chipH / 2 + 5
    )
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

function drawEdge(ctx: CanvasRenderingContext2D, e: Edge) {
  const a = anchor(e.src, e.sfx, e.sfy)
  const b = anchor(e.tgt, e.tfx, e.tfy)

  const dx = b.x - a.x
  const cp1x = a.x + dx * 0.5
  const cp1y = a.y
  const cp2x = a.x + dx * 0.5
  const cp2y = b.y

  ctx.save()
  ctx.strokeStyle = YELLOW
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y)
  ctx.stroke()

  ctx.fillStyle = YELLOW
  ctx.beginPath()
  ctx.arc(a.x, a.y, 5.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(b.x, b.y, 5.2, 0, Math.PI * 2)
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
  // leaving huge empty gutters around the scene.
  const z = Math.min(cssW / CONTENT_W, cssH / CONTENT_H) * 0.92 * dpr
  vz = z
  vx = canvas.width / 2 - CONTENT_CX * z
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
  if (isSliding) {
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
    canvas.style.cursor = hitTest(w.x, w.y) ? 'grab' : 'default'
  }
}

function onPointerUp() {
  const canvas = canvasRef.value
  dragId = null
  isSliding = null
  if (canvas) canvas.style.cursor = 'default'
}

function defineNodes() {
  nodes = {
    'n-green': {
      x: 25,
      y: 350,
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
      x: 875,
      y: 100,
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
      x: 875,
      y: 650,
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
      x: 1375,
      y: 250,
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
      x: 425,
      y: 530,
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
      src: 'n-red',
      sfx: (339 - 24) / 339,
      sfy: 24 / 409,
      tgt: 'n-purple',
      tfx: 42 / 595,
      tfy: 64 / 718
    },
    {
      src: 'n-blue',
      sfx: (339 - 24) / 339,
      sfy: 24 / 409,
      tgt: 'n-purple',
      tfx: 42 / 595,
      tfy: 122 / 718
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
