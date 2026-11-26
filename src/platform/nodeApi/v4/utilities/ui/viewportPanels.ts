import { watch } from 'vue'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { CanvasSource } from '@/platform/nodeApi/shared/canvasSource'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import type {
  Unsubscribe,
  ViewportPanelAnchor,
  ViewportPanelDef
} from '@/platform/nodeApi/v4/types'
import {
  isCallback,
  isFiniteNumber,
  isName,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'
import type { PackObject } from '@/platform/nodeApi/v4/utilities/packArguments'

const MEMBER = 'ui.mountViewportPanel'

const PANEL_FIELDS = {
  id: true,
  ariaLabel: true,
  anchor: true,
  offsetX: true,
  offsetY: true,
  width: true,
  maxHeight: true,
  render: true
} satisfies Record<keyof ViewportPanelDef, true>

const ANCHORS: readonly ViewportPanelAnchor[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
]

/** Mounts panels over the canvas the renderer supplies, refusing an id already mounted. */
export function createViewportPanels(canvas: () => CanvasSource | undefined) {
  const mounted = new Set<string>()

  return function mountViewportPanel(definition: unknown): Unsubscribe {
    const fields = packObject(
      MEMBER,
      'a viewport panel',
      definition,
      PANEL_FIELDS
    )
    const id = fields.required('id', isName, 'a non-empty string')
    const panel = panelElement(id, fields)
    const render = fields.required('render', isCallback, 'a function')
    if (mounted.has(id)) {
      throw invalidArgument(MEMBER, 'an id no mounted panel has', id)
    }
    mounted.add(id)
    const stopWaiting = onceViewShown(canvas, (view) => {
      view.append(panel)
      callListener(MEMBER, () => render(panel))
    })
    let removed = false
    return () => {
      if (removed) return
      removed = true
      stopWaiting()
      mounted.delete(id)
      panel.remove()
    }
  }
}

function onceViewShown(
  canvas: () => CanvasSource | undefined,
  shown: (view: HTMLElement) => void
): () => void {
  const viewOf = () => canvas()?.canvas()?.canvas.parentElement
  const view = viewOf()
  if (view) {
    shown(view)
    return () => {}
  }
  const stop = watch(
    viewOf,
    (next) => {
      if (!next) return
      stop()
      shown(next)
    },
    { flush: 'sync' }
  )
  return stop
}

function panelElement(
  id: string,
  fields: PackObject<keyof typeof PANEL_FIELDS>
): HTMLElement {
  const ariaLabel = fields.required('ariaLabel', isName, 'a non-empty string')
  const anchor =
    fields.optional('anchor', isAnchor, ANCHORS.join(', ')) ?? 'top-left'
  const offsetX =
    fields.optional('offsetX', isFiniteNumber, 'a finite number') ?? 0
  const offsetY =
    fields.optional('offsetY', isFiniteNumber, 'a finite number') ?? 0
  const width = fields.optional(
    'width',
    isPixelSize,
    'a positive finite number'
  )
  const maxHeight = fields.optional(
    'maxHeight',
    isPixelSize,
    'a positive finite number'
  )
  const panel = document.createElement('div')
  panel.dataset.viewportPanel = id
  panel.setAttribute('role', 'region')
  panel.setAttribute('aria-label', ariaLabel)
  Object.assign(panel.style, {
    position: 'absolute',
    zIndex: '1',
    overflow: 'auto',
    maxWidth: '100%',
    width: width === undefined ? '' : `${width}px`,
    maxHeight: maxHeight === undefined ? '' : `${maxHeight}px`,
    ...placement(anchor, offsetX, offsetY)
  })
  return panel
}

function isAnchor(value: unknown): value is ViewportPanelAnchor {
  return ANCHORS.some((anchor) => anchor === value)
}

function isPixelSize(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function placement(
  anchor: ViewportPanelAnchor,
  offsetX: number,
  offsetY: number
): Record<string, string> {
  const [vertical, horizontal] = anchor.split('-')
  return horizontal === 'center'
    ? {
        [vertical]: `${offsetY}px`,
        left: '50%',
        transform: `translateX(calc(-50% + ${offsetX}px))`
      }
    : { [vertical]: `${offsetY}px`, [horizontal]: `${offsetX}px` }
}
