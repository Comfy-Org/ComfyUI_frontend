import { hashText, seededRandom } from './random'
import type { SceneId } from './setup'

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

function gradient(
  ctx: CanvasRenderingContext2D,
  h: number,
  stops: readonly string[]
) {
  const fill = ctx.createLinearGradient(0, 0, 0, h)
  stops.forEach((color, index) =>
    fill.addColorStop(index / (stops.length - 1), color)
  )
  return fill
}

function bokeh(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  colors: readonly string[],
  band: [number, number]
) {
  const random = seededRandom(seed)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let index = 0; index < 34; index++) {
    const x = random() * w
    const y = (band[0] + random() * (band[1] - band[0])) * h
    const r = (0.008 + random() * 0.03) * w
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
    const color = colors[index % colors.length]
    glow.addColorStop(0, color)
    glow.addColorStop(0.7, color)
    glow.addColorStop(1, 'transparent')
    ctx.globalAlpha = 0.18 + random() * 0.3
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const redCarpet: Draw = (ctx, w, h) => {
  ctx.fillStyle = gradient(ctx, h, ['#16131f', '#241a2c', '#120f18'])
  ctx.fillRect(0, 0, w, h)
  const cell = w / 14
  ctx.fillStyle = 'rgba(214, 196, 160, 0.09)'
  for (let row = 0; row < 8; row++)
    for (let col = -1; col < 16; col++) {
      const x = col * cell + (row % 2) * (cell / 2)
      const y = row * cell * 0.62 + cell * 0.2
      ctx.beginPath()
      ctx.moveTo(x, y - cell * 0.08)
      ctx.lineTo(x + cell * 0.08, y)
      ctx.lineTo(x, y + cell * 0.08)
      ctx.lineTo(x - cell * 0.08, y)
      ctx.fill()
    }
  ctx.fillStyle = gradient(ctx, h, ['#5e0d18', '#8f1424', '#b31d2f'])
  ctx.beginPath()
  ctx.moveTo(w * 0.3, h * 0.62)
  ctx.lineTo(w * 0.7, h * 0.62)
  ctx.lineTo(w * 1.1, h)
  ctx.lineTo(-w * 0.1, h)
  ctx.fill()
  ctx.fillStyle = '#c9a24b'
  for (const x of [0.08, 0.92]) {
    ctx.fillRect(w * x - w * 0.006, h * 0.5, w * 0.012, h * 0.3)
    ctx.beginPath()
    ctx.arc(w * x, h * 0.5, w * 0.012, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#6d1120'
  ctx.lineWidth = h * 0.018
  ctx.beginPath()
  ctx.moveTo(w * 0.08, h * 0.53)
  ctx.quadraticCurveTo(w * 0.2, h * 0.62, w * 0.3, h * 0.55)
  ctx.moveTo(w * 0.92, h * 0.53)
  ctx.quadraticCurveTo(w * 0.8, h * 0.62, w * 0.7, h * 0.55)
  ctx.stroke()
}

const streetNight: Draw = (ctx, w, h) => {
  ctx.fillStyle = gradient(ctx, h, ['#070b1c', '#14203f', '#0b1022'])
  ctx.fillRect(0, 0, w, h)
  const random = seededRandom(31)
  for (let index = 0; index < 7; index++) {
    const x = (index / 7) * w
    const top = h * (0.05 + random() * 0.2)
    ctx.fillStyle = index % 2 ? '#10172d' : '#0d1326'
    ctx.fillRect(x, top, w / 7 + 2, h * 0.66 - top)
    for (let wy = top + h * 0.04; wy < h * 0.6; wy += h * 0.07)
      for (let wx = x + w * 0.015; wx < x + w / 7 - w * 0.02; wx += w * 0.03)
        if (random() < 0.4) {
          ctx.fillStyle = random() < 0.7 ? '#e9b765' : '#9fc2ff'
          ctx.globalAlpha = 0.35 + random() * 0.4
          ctx.fillRect(wx, wy, w * 0.014, h * 0.03)
          ctx.globalAlpha = 1
        }
  }
  ctx.fillStyle = gradient(ctx, h, ['#11182c', '#1d2742', '#0c111f'])
  ctx.fillRect(0, h * 0.66, w, h * 0.34)
  bokeh(ctx, w, h, 7, ['#ffb35c', '#ff6d7a', '#7fb6ff'], [0.25, 0.65])
  bokeh(ctx, w, h, 8, ['#ffb35c', '#7fb6ff'], [0.7, 0.95])
}

const cafe: Draw = (ctx, w, h) => {
  ctx.fillStyle = gradient(ctx, h, ['#3b2618', '#5a3a22', '#2a1b11'])
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255, 226, 170, 0.22)'
  ctx.fillRect(w * 0.05, h * 0.08, w * 0.9, h * 0.5)
  ctx.strokeStyle = '#2a1a0f'
  ctx.lineWidth = w * 0.012
  for (const x of [0.05, 0.35, 0.65, 0.95]) {
    ctx.beginPath()
    ctx.moveTo(w * x, h * 0.08)
    ctx.lineTo(w * x, h * 0.58)
    ctx.stroke()
  }
  ctx.strokeRect(w * 0.05, h * 0.08, w * 0.9, h * 0.5)
  ctx.fillStyle = '#7a1e22'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(w, 0)
  ctx.lineTo(w, h * 0.06)
  for (let x = w; x >= 0; x -= w / 18)
    ctx.quadraticCurveTo(x - w / 36, h * 0.11, x - w / 18, h * 0.06)
  ctx.fill()
  bokeh(ctx, w, h, 12, ['#ffd38a', '#fff1c9'], [0.1, 0.5])
  ctx.fillStyle = '#d9cbb3'
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.98, w * 0.42, h * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
}

const airport: Draw = (ctx, w, h) => {
  ctx.fillStyle = gradient(ctx, h, ['#c9d6dd', '#e6ecef', '#9aa7ae'])
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = gradient(ctx, h * 0.55, ['#8fb5d6', '#cfe1ee'])
  ctx.fillRect(0, h * 0.1, w, h * 0.45)
  ctx.strokeStyle = '#4a565e'
  ctx.lineWidth = w * 0.006
  for (let x = 0; x <= w; x += w / 8) {
    ctx.beginPath()
    ctx.moveTo(x, h * 0.1)
    ctx.lineTo(x, h * 0.55)
    ctx.stroke()
  }
  ctx.fillStyle = '#5b666d'
  ctx.fillRect(0, h * 0.55, w, h * 0.02)
  ctx.fillStyle = '#1b2024'
  ctx.fillRect(w * 0.62, h * 0.16, w * 0.3, h * 0.14)
  ctx.fillStyle = '#f0b43c'
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 12; col++)
      if ((row * 7 + col * 3) % 5)
        ctx.fillRect(
          w * (0.635 + col * 0.022),
          h * (0.18 + row * 0.03),
          w * 0.014,
          h * 0.012
        )
  ctx.fillStyle = gradient(ctx, h, ['#b3bec4', '#d2d9dc', '#8c979d'])
  ctx.fillRect(0, h * 0.57, w, h * 0.43)
  bokeh(ctx, w, h, 21, ['#ffffff', '#e9f3ff'], [0.05, 0.12])
}

function custom(text: string): Draw {
  const hue = hashText(text) % 360
  return (ctx, w, h) => {
    ctx.fillStyle = gradient(ctx, h, [
      `hsl(${hue} 35% 10%)`,
      `hsl(${hue} 40% 20%)`,
      `hsl(${hue} 30% 8%)`
    ])
    ctx.fillRect(0, 0, w, h)
    bokeh(
      ctx,
      w,
      h,
      hashText(text),
      [`hsl(${(hue + 30) % 360} 90% 70%)`, `hsl(${hue} 80% 75%)`, '#fff1d6'],
      [0.1, 0.7]
    )
  }
}

const SCENES = {
  'red-carpet': redCarpet,
  'street-night': streetNight,
  cafe,
  airport
} as const satisfies Record<SceneId, Draw>

/** Paints a scene's backdrop: a preset, or one tinted by the visitor's text. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneId | 'custom',
  description: string,
  w: number,
  h: number
) {
  const draw = scene === 'custom' ? custom(description) : SCENES[scene]
  draw(ctx, w, h)
}
