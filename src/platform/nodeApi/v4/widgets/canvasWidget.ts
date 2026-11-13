import { callListener } from '@/platform/nodeApi/shared/listeners'
import type {
  CanvasDef,
  CanvasPointerEvent,
  CanvasTheme,
  MountedValue
} from '@/platform/nodeApi/v4/types'
import { definitionFields } from './definitionFields'
import { checkedMountDef, packFunction } from './mountedWidget'
import type { MountSpec } from './mountedWidget'

type Draw = CanvasDef['draw']
type PointerHandler = (event: CanvasPointerEvent) => void

const FIELDS = [
  'name',
  'draw',
  'onPointerDown',
  'onPointerMove',
  'onPointerUp',
  'height',
  'defaultValue',
  'serialize',
  'sendToPrompt'
] as const satisfies readonly (keyof CanvasDef)[]

const THEME_COLORS: Readonly<Record<keyof CanvasTheme, [string, string]>> = {
  surface: ['--color-input', 'transparent'],
  surfaceHovered: ['--color-accent', 'transparent'],
  border: ['--color-node-border', 'currentColor'],
  text: ['--color-node-foreground', 'currentColor'],
  textSecondary: ['--color-muted-foreground', 'currentColor']
}

/** A canvas definition from a pack, checked, as the mount that carries it. */
export function checkedCanvasDef(def: unknown): {
  readonly spec: MountSpec
  readonly redraw: () => void
} {
  const fields = definitionFields('canvas', def, FIELDS)
  const { name, height, defaultValue, serialize, sendToPrompt } = fields
  const draw: Draw = packFunction('canvas', fields.draw)
  const handlers = {
    pointerdown: optionalHandler(fields.onPointerDown),
    pointermove: optionalHandler(fields.onPointerMove),
    pointerup: optionalHandler(fields.onPointerUp)
  }
  const surface = canvasSurface(draw, handlers, defaultValue !== undefined)
  const mount = checkedMountDef('canvas', {
    name,
    height,
    defaultValue,
    serialize,
    sendToPrompt,
    render: surface.render,
    destroy: surface.release
  })
  return {
    spec: { ...mount, written: surface.redraw },
    redraw: surface.redraw
  }
}

function optionalHandler(handler: unknown): PointerHandler | undefined {
  return handler === undefined ? undefined : packFunction('canvas', handler)
}

function canvasSurface(
  draw: Draw,
  handlers: Readonly<Record<string, PointerHandler | undefined>>,
  holdsValue: boolean
) {
  const element = document.createElement('canvas')
  const controller = new AbortController()
  let mounted: { container: HTMLElement; value: MountedValue } | undefined
  let observer: ResizeObserver | undefined

  function redraw(): void {
    if (!mounted || controller.signal.aborted) return
    paint(
      element,
      mounted.container,
      draw,
      holdsValue ? mounted.value : undefined
    )
  }

  function listen(): void {
    for (const [type, handler] of Object.entries(handlers)) {
      if (!handler) continue
      element.addEventListener(
        type,
        (event) => {
          if (event instanceof PointerEvent && claims(element, event)) {
            callListener('canvas.pointer', () =>
              handler(pointerAt(element, event))
            )
          }
        },
        { signal: controller.signal }
      )
    }
  }

  return {
    render(container: HTMLElement, value: MountedValue) {
      mounted = { container, value }
      container.append(element)
      listen()
      observer = new ResizeObserver(redraw)
      observer.observe(container)
      redraw()
    },
    release() {
      controller.abort()
      observer?.disconnect()
    },
    redraw
  }
}

function claims(element: HTMLCanvasElement, event: PointerEvent): boolean {
  if (event.type === 'pointerdown') {
    if (event.button !== 0) return false
    event.stopPropagation()
    element.setPointerCapture(event.pointerId)
  }
  if (
    event.type === 'pointerup' &&
    element.hasPointerCapture(event.pointerId)
  ) {
    element.releasePointerCapture(event.pointerId)
  }
  return true
}

function paint(
  element: HTMLCanvasElement,
  container: HTMLElement,
  draw: Draw,
  value: MountedValue | undefined
): void {
  const context = element.getContext('2d')
  if (!context) return
  const width = container.clientWidth
  const height = container.clientHeight
  const ratio = window.devicePixelRatio || 1
  element.style.width = `${width}px`
  element.style.height = `${height}px`
  element.width = Math.round(width * ratio)
  element.height = Math.round(height * ratio)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  const size = Object.freeze([width, height] as const)
  callListener('canvas.draw', () =>
    draw(context, size, themeOf(element), value)
  )
}

function pointerAt(
  element: HTMLCanvasElement,
  event: PointerEvent
): CanvasPointerEvent {
  const bounds = element.getBoundingClientRect()
  const scale = bounds.width ? element.clientWidth / bounds.width : 1
  return Object.freeze({
    x: (event.clientX - bounds.left) * scale,
    y: (event.clientY - bounds.top) * scale,
    event
  })
}

function themeOf(element: HTMLElement): CanvasTheme {
  const style = getComputedStyle(element)
  const color = ([token, fallback]: [string, string]) =>
    style.getPropertyValue(token).trim() || fallback
  return Object.freeze({
    surface: color(THEME_COLORS.surface),
    surfaceHovered: color(THEME_COLORS.surfaceHovered),
    border: color(THEME_COLORS.border),
    text: color(THEME_COLORS.text),
    textSecondary: color(THEME_COLORS.textSecondary)
  })
}
