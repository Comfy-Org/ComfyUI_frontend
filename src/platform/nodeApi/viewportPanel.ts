import { ComfyApiError } from './errors'

const PANEL_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
] as const

/** A panel the pack renders over the graph view. */
export interface ViewportPanelDef {
  /** Namespaced to the pack. */
  readonly id: string
  /** The edge or corner the panel sits against. Defaults to `'top-left'`. */
  readonly anchor?: (typeof PANEL_ANCHORS)[number]
  /** Pixels in from the anchored side, or along from the centre. */
  readonly offsetX?: number
  /** Pixels in from the anchored top or bottom. */
  readonly offsetY?: number
  readonly width?: number
  readonly maxHeight?: number
  readonly ariaLabel?: string
  /** Fills the panel. Called once, with an element already in the document. */
  render(container: HTMLElement): void
  destroy?(): void
}

export interface ViewportPanelHandle {
  remove(): void
}

function placement({
  anchor = 'top-left',
  offsetX = 0,
  offsetY = 0
}: ViewportPanelDef): Record<string, string> {
  const [vertical, horizontal] = anchor.split('-')
  return {
    [vertical]: `${offsetY}px`,
    ...(horizontal === 'center'
      ? { left: '50%', transform: `translateX(calc(-50% + ${offsetX}px))` }
      : { [horizontal]: `${offsetX}px` })
  }
}

function assertPanelDef(def: ViewportPanelDef): void {
  if (typeof def.id !== 'string' || !def.id.trim()) {
    throw new ComfyApiError('A viewport panel needs an id.')
  }
  if (typeof def.render !== 'function') {
    throw new ComfyApiError(
      `Viewport panel '${def.id}' needs a render function.`
    )
  }
  if (
    def.anchor !== undefined &&
    !PANEL_ANCHORS.some((anchor) => anchor === def.anchor)
  ) {
    throw new ComfyApiError(
      `Viewport panel anchor must be one of ${PANEL_ANCHORS.join(', ')}.`
    )
  }
  const sizes = [def.offsetX, def.offsetY, def.width, def.maxHeight]
  if (sizes.some((size) => size !== undefined && !Number.isFinite(size))) {
    throw new ComfyApiError(
      `Viewport panel '${def.id}' offsets and sizes must be finite numbers.`
    )
  }
}

export function mountViewportPanel(def: ViewportPanelDef): ViewportPanelHandle {
  assertPanelDef(def)
  const view = document.getElementById('graph-canvas')?.parentElement
  if (!view) {
    throw new ComfyApiError(
      `Cannot mount viewport panel '${def.id}': no graph view is open.`
    )
  }
  const panel = document.createElement('div')
  panel.dataset.viewportPanel = def.id
  panel.setAttribute('role', 'region')
  if (def.ariaLabel) panel.setAttribute('aria-label', def.ariaLabel)
  Object.assign(panel.style, {
    position: 'absolute',
    zIndex: '1',
    overflow: 'auto',
    maxWidth: '100%',
    ...(def.width === undefined ? {} : { width: `${def.width}px` }),
    ...(def.maxHeight === undefined ? {} : { maxHeight: `${def.maxHeight}px` }),
    ...placement(def)
  })
  view.append(panel)
  try {
    def.render(panel)
  } catch (error) {
    panel.remove()
    throw error
  }
  return Object.freeze({
    remove() {
      if (!panel.isConnected) return
      panel.remove()
      def.destroy?.()
    }
  })
}
