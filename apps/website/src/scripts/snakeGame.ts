interface Cell {
  i: number
  j: number
}

interface Dir {
  i: number
  j: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  fill: string
  spin: number
  rot0: number
  scale: number
}

// ------- CONFIG -------
const COLS = 19
const ROWS = 13

const HEX_W = 72
const HEX_H = HEX_W * 1.108

const STEP_X = HEX_W * 0.616
const STEP_Y = HEX_H * 0.335

const CORNER_R = 14
const LIFT = HEX_H * 0.35
const TICK_MS = 200

function readColors() {
  const style = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback

  return {
    bg: get('--color-primary-comfy-ink', '#211927'),
    fieldStroke: get('--color-secondary-mauve', '#4D3762'),
    snakeA: get('--color-primary-comfy-plum', '#49378B'),
    snakeB: get('--color-secondary-mauve', '#4D3762'),
    accent: get('--color-primary-comfy-yellow', '#F2FF59')
  }
}

const COLORS = readColors()

// ------- DOM GUARDS -------
function requireElement<T extends Element>(
  id: string,
  guard: (el: Element) => el is T
): T {
  const el = document.getElementById(id)
  if (!el || !guard(el)) throw new Error(`Missing element: #${id}`)
  return el
}

const isSVGSVG = (el: Element): el is SVGSVGElement =>
  el instanceof SVGSVGElement
const isSVGG = (el: Element): el is SVGGElement => el instanceof SVGGElement
function isSVGText(el: Element): el is SVGTextElement {
  return el instanceof SVGTextElement
}
function isHTMLDiv(el: Element): el is HTMLDivElement {
  return el instanceof HTMLDivElement
}
function isHTMLSpan(el: Element): el is HTMLSpanElement {
  return el instanceof HTMLSpanElement
}

function setOverlayVisible(el: HTMLElement, visible: boolean) {
  el.classList.toggle('hidden', !visible)
  el.classList.toggle('flex', visible)
}

// ------- DIRECTIONS & CONTROLS -------
const DIRS = {
  up: { i: 0, j: -1 },
  down: { i: 0, j: 1 },
  left: { i: -1, j: 0 },
  right: { i: 1, j: 0 }
} satisfies Record<string, Dir>
const ALL_DIRS = [DIRS.up, DIRS.down, DIRS.left, DIRS.right]

const KEY_INTENTS: Record<string, [number, number]> = {
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0]
}

function resolveTurn(intent: [number, number], heading: Dir): Dir | null {
  const legal = ALL_DIRS.filter(
    (d) =>
      !(d.i === heading.i && d.j === heading.j) &&
      !(d.i === -heading.i && d.j === -heading.j)
  )
  let best: Dir | null = null
  let bestScore = -Infinity
  for (const d of legal) {
    const [sx, sy] = iso(d.i, d.j)
    const score = sx * intent[0] + sy * intent[1]
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}

// ------- GEOMETRY -------
function iso(i: number, j: number): [number, number] {
  return [(i - j) * STEP_X, (i + j) * STEP_Y]
}

function depth(cell: Cell): number {
  return cell.i + cell.j
}

function roundedPath(pts: [number, number][], radius: number): string {
  const n = pts.length
  const fmt = (p: readonly [number, number]) =>
    `${p[0].toFixed(2)},${p[1].toFixed(2)}`
  let d = ''
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const curr = pts[i]
    const next = pts[(i + 1) % n]
    const [cx, cy] = curr
    const v1x = prev[0] - cx,
      v1y = prev[1] - cy
    const v2x = next[0] - cx,
      v2y = next[1] - cy
    const l1 = Math.hypot(v1x, v1y) || 1
    const l2 = Math.hypot(v2x, v2y) || 1
    const r = Math.min(radius, l1 * 0.45, l2 * 0.45)
    const p1: [number, number] = [cx + (v1x / l1) * r, cy + (v1y / l1) * r]
    const p2: [number, number] = [cx + (v2x / l2) * r, cy + (v2y / l2) * r]
    d += (i === 0 ? 'M' : 'L') + fmt(p1)
    d += `C${fmt(curr)} ${fmt(curr)} ${fmt(p2)}`
  }
  return d + 'Z'
}

function hexPath(
  cx: number,
  cy: number,
  w = HEX_W,
  h = HEX_H,
  radius = CORNER_R
): string {
  const hw = w / 2,
    hh = h / 2,
    qh = h / 4
  return roundedPath(
    [
      [cx, cy - hh],
      [cx + hw, cy - qh],
      [cx + hw, cy + qh],
      [cx, cy + hh],
      [cx - hw, cy + qh],
      [cx - hw, cy - qh]
    ],
    radius
  )
}

function fieldPath(): string {
  const padX = STEP_X * 1.5
  const padY = STEP_Y * 2.5
  const [topX, topY] = iso(0, 0)
  const [rightX, rightY] = iso(COLS - 1, 0)
  const [botX, botY] = iso(COLS - 1, ROWS - 1)
  const [leftX, leftY] = iso(0, ROWS - 1)
  return roundedPath(
    [
      [topX, topY - padY],
      [rightX + padX, rightY - padY * 0.2],
      [botX, botY + padY],
      [leftX - padX, leftY + padY * 0.2]
    ],
    60
  )
}
const FIELD_PATH = fieldPath()

// ------- EXPLOSION -------
const EXPLODE_DURATION_MS = 1000
const EXPLODE_SPEED = 900
const EXPLODE_GRAVITY = 2600
const EXPLODE_SPIN = 540
let explodeStart = 0
let explodeParticles: Particle[] | null = null
let animationHandle: number | null = null

function triggerExplosion() {
  explodeStart = performance.now()
  const cx = ((COLS - ROWS) * STEP_X) / 2
  const cy = ((COLS + ROWS - 2) * STEP_Y) / 2

  const launchParticle = (i: number, j: number, fill: string): Particle => {
    const [sx, sy] = iso(i, j)
    const baseAngle = Math.atan2(sy - cy, sx - cx)
    const angle = baseAngle + (Math.random() - 0.5) * 1.2
    const speed = EXPLODE_SPEED * (0.6 + Math.random() * 0.8)
    return {
      x: sx,
      y: sy - LIFT,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - EXPLODE_SPEED * 0.4,
      fill,
      spin: (Math.random() - 0.5) * 2 * EXPLODE_SPIN,
      rot0: Math.random() * 360,
      scale: 0.85 + Math.random() * 0.3
    }
  }

  explodeParticles = snake.map((seg, idx) =>
    launchParticle(
      seg.i,
      seg.j,
      idx === 0 ? COLORS.accent : idx % 2 ? COLORS.snakeB : COLORS.snakeA
    )
  )
  explodeParticles.push(launchParticle(food.i, food.j, COLORS.accent))

  ensureAnimationLoop()
}

// ------- FOOD DROP -------
const DROP_DURATION_MS = 450
const DROP_HEIGHT = 600
let foodDropStart = 0
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

function foodDropOffset(now = performance.now()): number {
  if (!foodDropStart) return 0
  const t = (now - foodDropStart) / DROP_DURATION_MS
  if (t >= 1) return 0
  return DROP_HEIGHT * (1 - easeOutCubic(t))
}

// ------- REBIRTH -------
const REBIRTH_STAGGER_MS = 90
const REBIRTH_GROW_MS = 260
let rebirthStart = 0
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function rebirthScaleFor(idx: number, now = performance.now()): number {
  if (!rebirthStart) return 1
  const localT =
    (now - rebirthStart - idx * REBIRTH_STAGGER_MS) / REBIRTH_GROW_MS
  if (localT <= 0) return 0
  if (localT >= 1) return 1
  return Math.max(0, easeOutBack(localT))
}

// ------- EAT FEEDBACK -------
const CHOMP_DURATION_MS = 220
const CHOMP_PEAK_SCALE = 1.15
let chompStart = 0
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)

function chompScale(now = performance.now()): number {
  if (!chompStart) return 1
  const t = (now - chompStart) / CHOMP_DURATION_MS
  if (t >= 1) return 1
  const peakT = 0.25
  let p: number
  if (t < peakT) {
    p = easeOut(t / peakT)
  } else {
    p = 1 - easeOut((t - peakT) / (1 - peakT))
  }
  return 1 + (CHOMP_PEAK_SCALE - 1) * p
}

// ------- ANIMATION LOOP -------
function isAnimating(): boolean {
  return (
    explodeStart !== 0 ||
    foodDropStart !== 0 ||
    rebirthStart !== 0 ||
    chompStart !== 0
  )
}

function ensureAnimationLoop() {
  if (animationHandle !== null) return
  const tick = () => {
    if (
      explodeStart &&
      performance.now() - explodeStart >= EXPLODE_DURATION_MS
    ) {
      explodeStart = 0
      explodeParticles = null
    }
    if (
      foodDropStart &&
      performance.now() - foodDropStart >= DROP_DURATION_MS
    ) {
      foodDropStart = 0
    }
    if (rebirthStart) {
      const total =
        REBIRTH_GROW_MS + Math.max(0, snake.length - 1) * REBIRTH_STAGGER_MS
      if (performance.now() - rebirthStart >= total) {
        rebirthStart = 0
      }
    }
    if (chompStart && performance.now() - chompStart >= CHOMP_DURATION_MS) {
      chompStart = 0
    }

    render()

    if (isAnimating()) {
      animationHandle = requestAnimationFrame(tick)
    } else {
      animationHandle = null
    }
  }
  animationHandle = requestAnimationFrame(tick)
}

let audioCtx: AudioContext | null = null
function audio(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext()
    } catch {
      audioCtx = null
    }
  }
  return audioCtx
}

function playEatSound() {
  const ctx = audio()
  if (!ctx) return
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(880, t0)
  osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.08)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + 0.15)
}

function onEat() {
  chompStart = performance.now()
  ensureAnimationLoop()
  playEatSound()
}

// ------- GAME STATE -------
const board = requireElement('board', isSVGG)
const pauseOverlay = requireElement('pauseOverlay', isHTMLDiv)
const svg = requireElement('game', isSVGSVG)
const startCta = requireElement('startCta', isSVGText)
const scoreNowEl = requireElement('scoreNow', isHTMLSpan)
const scoreBestEl = requireElement('scoreBest', isHTMLSpan)

let best = loadBest()
let waitingToStart = true

let snake: Cell[]
let dir: Dir
let nextDir: Dir
let food: Cell
let score: number
let alive: boolean
let paused: boolean
let tickHandle: number | null = null
let restartTimeout: number | null = null

function loadBest(): number {
  try {
    return parseInt(localStorage.getItem('iso_snake_best') || '0', 10)
  } catch {
    return 0
  }
}
function saveBest(v: number) {
  try {
    localStorage.setItem('iso_snake_best', String(v))
  } catch {
    /* noop */
  }
}

function updateScoreDisplay() {
  scoreNowEl.textContent = String(score)
  scoreBestEl.textContent = String(best)
}

const cellsEqual = (a: Cell, b: Cell) => a.i === b.i && a.j === b.j
const inBounds = (c: Cell) => c.i >= 0 && c.j >= 0 && c.i < COLS && c.j < ROWS

function reset() {
  const j0 = Math.floor(ROWS / 2)
  snake = [
    { i: 4, j: j0 },
    { i: 3, j: j0 },
    { i: 2, j: j0 }
  ]
  dir = nextDir = DIRS.right
  score = 0
  alive = true
  paused = false
  setOverlayVisible(pauseOverlay, false)
  chompStart = 0
  foodDropStart = 0
  explodeStart = 0
  explodeParticles = null
  if (animationHandle !== null) {
    cancelAnimationFrame(animationHandle)
    animationHandle = null
  }
  rebirthStart = performance.now()
  placeFood()
  updateScoreDisplay()
  render()
  ensureAnimationLoop()
}

function placeFood() {
  do {
    food = {
      i: Math.floor(Math.random() * COLS),
      j: Math.floor(Math.random() * ROWS)
    }
  } while (snake.some((s) => cellsEqual(s, food)))
  foodDropStart = performance.now()
  ensureAnimationLoop()
}

function step() {
  if (!alive || paused) return

  if (performance.now() >= keyboardUntil) {
    const mouseDir = mouseTargetDir()
    if (mouseDir) nextDir = mouseDir
  }

  dir = nextDir
  const head: Cell = { i: snake[0].i + dir.i, j: snake[0].j + dir.j }

  const willGrow = cellsEqual(head, food)
  const body = willGrow ? snake : snake.slice(0, -1)
  if (!inBounds(head) || body.some((s) => cellsEqual(s, head))) {
    snake.unshift(head)
    snake.pop()
    return gameOver()
  }

  snake.unshift(head)

  if (willGrow) {
    score += 1
    if (score > best) {
      best = score
      saveBest(best)
    }
    updateScoreDisplay()
    placeFood()
    onEat()
  } else {
    snake.pop()
  }

  render()
}

function gameOver() {
  alive = false
  paused = false
  setOverlayVisible(pauseOverlay, false)
  if (tickHandle !== null) {
    window.clearInterval(tickHandle)
    tickHandle = null
  }
  triggerExplosion()
  restartTimeout = window.setTimeout(() => {
    waitingToStart = true
    startCta.removeAttribute('display')
    reset()
  }, EXPLODE_DURATION_MS + 300)
}

// ------- RENDER -------
function render() {
  const parts: string[] = []

  parts.push(
    '<path d="' +
      FIELD_PATH +
      '" fill="' +
      COLORS.bg +
      '" stroke="' +
      COLORS.fieldStroke +
      '" stroke-width="3"/>'
  )

  const dropOffset = foodDropOffset()

  if (explodeParticles) {
    const t = (performance.now() - explodeStart) / 1000
    const fadeT = (performance.now() - explodeStart) / EXPLODE_DURATION_MS
    const opacity = fadeT < 0.7 ? 1 : Math.max(0, 1 - (fadeT - 0.7) / 0.3)

    for (const p of explodeParticles) {
      const x = p.x + p.vx * t
      const y = p.y + p.vy * t + 0.5 * EXPLODE_GRAVITY * t * t
      const rot = p.rot0 + p.spin * t
      const w = HEX_W * p.scale
      const h = HEX_H * p.scale
      parts.push(
        '<g transform="translate(' +
          x.toFixed(2) +
          ',' +
          y.toFixed(2) +
          ') rotate(' +
          rot.toFixed(1) +
          ')" opacity="' +
          opacity.toFixed(2) +
          '">' +
          '<path d="' +
          hexPath(0, 0, w, h) +
          '" fill="' +
          p.fill +
          '"/>' +
          '</g>'
      )
    }
    board.innerHTML = parts.join('')
    return
  }

  if (!alive) {
    board.innerHTML = parts.join('')
    return
  }

  const actors = [
    ...snake.map((s, idx) => ({
      ...s,
      fill: idx === 0 ? COLORS.accent : idx % 2 ? COLORS.snakeB : COLORS.snakeA,
      isHead: idx === 0,
      isFood: false,
      segIdx: idx
    })),
    { ...food, fill: COLORS.accent, isHead: false, isFood: true, segIdx: -1 }
  ].sort((a, b) => depth(a) - depth(b))

  const headScale = chompScale()
  const now = performance.now()

  for (const a of actors) {
    const [sx, sy] = iso(a.i, a.j)
    let s = a.isHead ? headScale : 1
    if (!a.isFood && rebirthStart) {
      s *= rebirthScaleFor(a.segIdx, now)
    }
    if (s <= 0) continue
    const yOff = a.isFood ? dropOffset : 0
    parts.push(
      '<path d="' +
        hexPath(sx, sy - LIFT - yOff, HEX_W * s, HEX_H * s) +
        '" fill="' +
        a.fill +
        '"/>'
    )
  }

  board.innerHTML = parts.join('')
}

function updateViewBox() {
  const [, topY] = iso(0, 0)
  const [rightX] = iso(COLS - 1, 0)
  const [, botY] = iso(COLS - 1, ROWS - 1)
  const [leftX] = iso(0, ROWS - 1)
  const padX = STEP_X * 2.2
  const padY = STEP_Y * 5.5 + LIFT
  const minX = leftX - padX
  const minY = topY - padY
  const w = rightX - leftX + padX * 2
  const h = botY - topY + padY * 2
  svg.setAttribute('viewBox', minX + ' ' + minY + ' ' + w + ' ' + h)
}

// ------- INPUT -------
const KEYBOARD_TIMEOUT_MS = 10000
let keyboardUntil = 0
let mousePos: { x: number; y: number } | null = null

function mouseToSvg(e: MouseEvent): { x: number; y: number } | null {
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

function onMouseMove(e: MouseEvent) {
  mousePos = mouseToSvg(e)
}

function onMouseLeave() {
  mousePos = null
}

svg.addEventListener('mousemove', onMouseMove)
svg.addEventListener('mouseleave', onMouseLeave)

function mouseTargetDir(): Dir | null {
  if (!mousePos || !snake) return null
  const [hx, hy] = iso(snake[0].i, snake[0].j)
  const dx = mousePos.x - hx
  const dy = mousePos.y - LIFT - hy
  if (Math.hypot(dx, dy) < HEX_W * 0.3) return null

  const candidates = ALL_DIRS.filter((d) => !(d.i === -dir.i && d.j === -dir.j))
  let best: Dir | null = null
  let bestScore = -Infinity
  for (const d of candidates) {
    const [vx, vy] = iso(d.i, d.j)
    const len = Math.hypot(vx, vy) || 1
    const score = (vx * dx + vy * dy) / len
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}

function onKeyDown(e: KeyboardEvent) {
  const key = e.key.toLowerCase()

  if (waitingToStart) {
    if (key === 'enter' || key === ' ') {
      e.preventDefault()
      startGame()
    }
    return
  }

  if (key === ' ') {
    e.preventDefault()
    if (alive) {
      paused = !paused
      setOverlayVisible(pauseOverlay, paused)
    }
    return
  }

  const intent = KEY_INTENTS[key]
  if (!intent) return
  e.preventDefault()
  keyboardUntil = performance.now() + KEYBOARD_TIMEOUT_MS
  const turn = resolveTurn(intent, dir)
  if (turn) nextDir = turn
}

document.addEventListener('keydown', onKeyDown)

function startGame() {
  if (restartTimeout !== null) {
    window.clearTimeout(restartTimeout)
    restartTimeout = null
  }
  waitingToStart = false
  startCta.setAttribute('display', 'none')
  if (tickHandle !== null) window.clearInterval(tickHandle)
  tickHandle = window.setInterval(step, TICK_MS)
}

function destroy() {
  if (tickHandle !== null) {
    window.clearInterval(tickHandle)
    tickHandle = null
  }
  if (restartTimeout !== null) {
    window.clearTimeout(restartTimeout)
    restartTimeout = null
  }
  if (animationHandle !== null) {
    cancelAnimationFrame(animationHandle)
    animationHandle = null
  }
  document.removeEventListener('keydown', onKeyDown)
  svg.removeEventListener('mousemove', onMouseMove)
  svg.removeEventListener('mouseleave', onMouseLeave)
  svg.removeEventListener('click', onSvgClick)
}

function onSvgClick() {
  if (waitingToStart) startGame()
}

svg.addEventListener('click', onSvgClick)

updateViewBox()
reset()
window.addEventListener('pagehide', destroy)
