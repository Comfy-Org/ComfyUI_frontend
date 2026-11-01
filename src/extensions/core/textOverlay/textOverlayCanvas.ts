export type TextOverlayPosition = 'top' | 'bottom'
export type TextOverlayAlign = 'left' | 'center' | 'right'

export interface TextOverlayParams {
  width: number
  height: number
  text: string
  fontSize: number
  position: TextOverlayPosition
  align: TextOverlayAlign
  outline: boolean
  paddingX: number
  paddingY: number
}

interface TextInk {
  ascent: number
  descent: number
}

export interface TextMeasurer {
  advance(text: string, size: number): number
  ink(text: string, size: number): TextInk
}

interface TextOverlayLine {
  text: string
  x: number
  baseline: number
}

export interface TextOverlayLayout {
  size: number
  stroke: number
  align: TextOverlayAlign
  lines: TextOverlayLine[]
}

const LINE_SPACING = 1.2
const MIN_FONT_PERCENT = 2.0
const MIN_FONT_PIXELS = 10
const OUTLINE_THICKNESS_FACTOR = 0.04
const SHRINK_FACTOR = 0.9

function pythonRound(value: number): number {
  const floor = Math.floor(value)
  if (value - floor !== 0.5) return Math.round(value)
  return floor % 2 === 0 ? floor : floor + 1
}

function normalizeOverlayText(text: string): string {
  return text.replaceAll('\\n', '\n').replaceAll('\\t', '\t')
}

function splitLongWord(
  word: string,
  maxWidth: number,
  measure: (text: string) => number
): [string, string] {
  let cut = 1
  while (cut < word.length && measure(word.slice(0, cut + 1)) <= maxWidth) {
    cut += 1
  }
  return [word.slice(0, cut), word.slice(cut)]
}

function breakLongWord(
  word: string,
  maxWidth: number,
  measure: (text: string) => number
): [string[], string] {
  const chunks: string[] = []
  let rest = word
  while (measure(rest) > maxWidth && rest.length > 1) {
    const [head, tail] = splitLongWord(rest, maxWidth, measure)
    chunks.push(head)
    rest = tail
  }
  return [chunks, rest]
}

function wrapLine(
  rawLine: string,
  maxWidth: number,
  measure: (text: string) => number
): string[] {
  const words = rawLine.split(/\s+/).filter(Boolean)
  if (!words.length) return ['']

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const [chunks, rest] = breakLongWord(word, maxWidth, measure)
    if (chunks.length) {
      if (current) lines.push(current)
      lines.push(...chunks)
      current = ''
    }
    const candidate = current ? `${current} ${rest}` : rest
    if (current && measure(candidate) > maxWidth) {
      lines.push(current)
      current = rest
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number
): string[] {
  return text.split('\n').flatMap((line) => wrapLine(line, maxWidth, measure))
}

function inkExtent(
  lines: string[],
  size: number,
  stroke: number,
  measurer: TextMeasurer
) {
  const advance = pythonRound(size * LINE_SPACING)
  let top = Infinity
  let bottom = -Infinity
  lines.forEach((line, index) => {
    if (!line) return
    const { ascent, descent } = measurer.ink(line, size)
    top = Math.min(top, index * advance - ascent)
    bottom = Math.max(bottom, index * advance + descent)
  })
  if (top === Infinity) return { top: 0, bottom: 0, advance }
  return { top: top - stroke, bottom: bottom + stroke, advance }
}

/**
 * Port of `TextOverlay.render_overlay_text` in ComfyUI's
 * comfy_extras/nodes_text_overlay.py. Keep both in sync.
 */
export function layoutTextOverlay(
  params: TextOverlayParams,
  measurer: TextMeasurer
): TextOverlayLayout {
  const { width, height, fontSize, position, align, outline } = params
  const { paddingX, paddingY } = params
  const text = normalizeOverlayText(params.text)

  const shortSide = Math.min(width, height)
  const marginX = pythonRound((paddingX / 100) * shortSide)
  const marginY = pythonRound((paddingY / 100) * shortSide)
  const maxWidth = Math.max(1, width - 2 * marginX)
  const maxHeight = Math.max(1, height - 2 * marginY)

  const fitAt = (size: number) => {
    const stroke = outline
      ? Math.max(1, pythonRound(size * OUTLINE_THICKNESS_FACTOR))
      : 0
    const lines = wrapText(text, maxWidth, (part) =>
      measurer.advance(part, size)
    )
    return { size, stroke, lines, ...inkExtent(lines, size, stroke, measurer) }
  }

  let fitted = fitAt(Math.max(1, pythonRound((fontSize / 100) * height)))
  const floor = Math.min(
    fitted.size,
    Math.max(MIN_FONT_PIXELS, pythonRound((MIN_FONT_PERCENT / 100) * height))
  )
  while (fitted.bottom - fitted.top > maxHeight && fitted.size > floor) {
    fitted = fitAt(Math.max(floor, Math.trunc(fitted.size * SHRINK_FACTOR)))
  }

  const x = { left: marginX, center: width / 2, right: width - marginX }[align]
  const firstBaseline =
    position === 'bottom'
      ? height - marginY - fitted.bottom
      : marginY - fitted.top

  return {
    size: fitted.size,
    stroke: fitted.stroke,
    align,
    lines: fitted.lines.map((line, index) => ({
      text: line,
      x,
      baseline: firstBaseline + index * fitted.advance
    }))
  }
}

const FONT_FAMILY = 'ComfyTextOverlayAileron'

let fontLoad: Promise<boolean> | undefined

/**
 * Waits for the Aileron subset that Pillow's `ImageFont.load_default` embeds
 * (declared in assets/css/fonts.css), so the canvas measures text exactly
 * like the backend instead of with a fallback font.
 */
export function loadTextOverlayFont(): Promise<boolean> {
  fontLoad ??= document.fonts
    .load(fontAt(16))
    .then(
      (faces) => faces.length > 0,
      () => false
    )
    .then((loaded) => {
      if (!loaded) fontLoad = undefined
      return loaded
    })
  return fontLoad
}

function fontAt(size: number) {
  return `${size}px ${FONT_FAMILY}`
}

export type TextOverlayCanvas = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'fillText'
  | 'strokeText'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'lineJoin'
  | 'lineWidth'
  | 'strokeStyle'
  | 'fillStyle'
> & {
  measureText(
    text: string
  ): Pick<
    TextMetrics,
    'width' | 'actualBoundingBoxAscent' | 'actualBoundingBoxDescent'
  >
}

function canvasMeasurer(ctx: TextOverlayCanvas): TextMeasurer {
  return {
    advance(text, size) {
      ctx.font = fontAt(size)
      return ctx.measureText(text).width
    },
    ink(text, size) {
      ctx.font = fontAt(size)
      const metrics = ctx.measureText(text)
      return {
        ascent: metrics.actualBoundingBoxAscent,
        descent: metrics.actualBoundingBoxDescent
      }
    }
  }
}

export interface TextOverlayStyle {
  color: string
}

export function drawTextOverlay(
  ctx: TextOverlayCanvas,
  params: TextOverlayParams,
  { color }: TextOverlayStyle
) {
  if (!params.text.trim()) return

  ctx.save()
  ctx.textBaseline = 'alphabetic'
  const layout = layoutTextOverlay(params, canvasMeasurer(ctx))
  ctx.font = fontAt(layout.size)
  ctx.textAlign = layout.align
  ctx.lineJoin = 'round'
  ctx.lineWidth = layout.stroke * 2
  ctx.strokeStyle = '#000000'
  ctx.fillStyle = color
  for (const line of layout.lines) {
    if (!line.text) continue
    if (layout.stroke > 0) ctx.strokeText(line.text, line.x, line.baseline)
    ctx.fillText(line.text, line.x, line.baseline)
  }
  ctx.restore()
}
