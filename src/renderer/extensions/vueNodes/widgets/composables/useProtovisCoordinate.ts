/**
 * Composable to fix protovis coordinate calculation in vueNodes mode.
 *
 * Problem: Protovis calculates mouse position using pageX/pageY minus the offsetParent chain.
 * But CSS transform on TransformPane changes where elements appear visually without
 * affecting offsetLeft/offsetTop.
 *
 * Solution: Patch pv.Mark.prototype.mouse to use getBoundingClientRect() which accounts
 * for CSS transforms, then apply protovis internal transforms.
 */

interface PvTransform {
  k: number
  x: number
  y: number
  translate: (x: number, y: number) => PvTransform
  times: (t: PvTransform) => PvTransform
  invert: () => PvTransform
}

interface PvMark {
  mouse: () => { x: number; y: number }
  root: { canvas: () => HTMLElement }
  parent: PvMark | null
  properties: { transform?: unknown }
  left: () => number
  top: () => number
  transform: () => PvTransform
}

interface Pv {
  Mark: { prototype: PvMark }
  Transform: { identity: PvTransform }
  event: MouseEvent | null
  vector: (x: number, y: number) => { x: number; y: number }
}

let originalMouseFn: (() => { x: number; y: number }) | null = null

const DATA_ATTR = 'data-vue-dom-widget-protovis'

function patchProtovisMouse() {
  const pv = (window as unknown as { pv?: Pv }).pv
  if (!pv?.Mark?.prototype?.mouse) return

  if (originalMouseFn) return
  originalMouseFn = pv.Mark.prototype.mouse

  pv.Mark.prototype.mouse = function (this: PvMark) {
    const e = pv.event
    if (!e) return pv.vector(0, 0)

    const svgCanvas = this.root.canvas()
    if (!svgCanvas) return pv.vector(0, 0)

    const widgetContainer = svgCanvas.closest(`[${DATA_ATTR}]`)
    if (!widgetContainer) {
      // Not in vueNodes mode or not a protovis widget, use original calculation
      return originalMouseFn!.call(this)
    }

    const rect = svgCanvas.getBoundingClientRect()

    const b = e.clientX - rect.left
    const c = e.clientY - rect.top

    let d: PvTransform = pv.Transform.identity
    const markWithTransform = this.properties.transform ? this : this.parent
    const marks: PvMark[] = []
    let current: PvMark | null = markWithTransform
    while (current) {
      marks.push(current)
      current = current.parent
    }
    for (let i = marks.length - 1; i >= 0; i--) {
      const mark = marks[i]
      d = d.translate(mark.left(), mark.top()).times(mark.transform())
    }
    d = d.invert()

    return pv.vector(b * d.k + d.x, c * d.k + d.y)
  }
}

/**
 * Check if a DOM element contains protovis content.
 * Protovis creates SVG elements with specific class patterns.
 */
function hasProtovisContent(element: HTMLElement): boolean {
  const pv = (window as unknown as { pv?: Pv }).pv
  if (!pv) return false

  const svg = element.querySelector('svg')
  if (!svg) return false

  return (
    svg.querySelector('g[transform]') !== null ||
    svg.querySelector('circle') !== null ||
    svg.querySelector('path') !== null
  )
}

/**
 * Apply protovis coordinate fix to a DOM widget container.
 * Call this in onMounted after the widget element is added.
 */
export function useProtovisCoordinate(element: HTMLElement | undefined) {
  if (!element) return

  if (!hasProtovisContent(element)) return

  element.setAttribute(DATA_ATTR, 'true')

  patchProtovisMouse()
}
