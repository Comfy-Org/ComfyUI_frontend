import { watch } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { CanvasSource } from '@/platform/nodeApi/v4/canvasSource'
import type { GraphOverlayHandle } from '@/platform/nodeApi/v4/types'
import {
  isBoolean,
  isCallback,
  isName,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'
import type { PackObject } from '@/platform/nodeApi/v4/utilities/packArguments'

import type { OverlayState } from './overlayInput'
import { readHitRegions } from './overlayRegions'
import { createOverlaySurface } from './overlaySurface'
import type { OverlayCallbacks } from './overlaySurface'

const MEMBER = 'ui.mountGraphOverlay'

type DrawForeground = NonNullable<LGraphCanvas['onDrawForeground']>

/** Mounts overlays on the canvas the renderer supplies, refusing an id already mounted. */
export function createGraphOverlays(source: () => CanvasSource | undefined) {
  const mounted = new Set<string>()
  const graphFrames = createHostEvent<[LGraphCanvas]>(MEMBER, (drawn) => {
    let unchain: (() => void) | undefined
    const stopWatching = watch(
      () => source()?.canvas() ?? undefined,
      (canvas) => {
        unchain?.()
        unchain = canvas && afterForeground(canvas, () => drawn(canvas))
      },
      { immediate: true, flush: 'sync' }
    )
    return () => {
      stopWatching()
      unchain?.()
    }
  })

  return function mountGraphOverlay(definition: unknown): GraphOverlayHandle {
    const fields = packObject(MEMBER, 'a graph overlay', definition)
    const id = fields.required('id', isName, 'a non-empty string')
    const element = overlayElement(
      id,
      fields.required('ariaLabel', isName, 'a non-empty string')
    )
    const state: OverlayState = {
      visible: fields.optional('visible', isBoolean, 'a boolean') ?? true,
      interactive:
        fields.optional('interactive', isBoolean, 'a boolean') ?? false,
      regions: undefined
    }
    const surface = createOverlaySurface(
      MEMBER,
      element,
      overlayCallbacks(fields),
      state
    )
    if (mounted.has(id)) {
      throw invalidArgument(MEMBER, 'an id no mounted overlay has', id)
    }
    mounted.add(id)
    surface.show(state.visible)
    const shown = source()?.canvas()
    if (shown) surface.attach(shown)
    const stopFollowing = graphFrames((canvas) => {
      surface.attach(canvas)
      surface.draw()
    })
    return overlayHandle(state, surface, () => {
      stopFollowing()
      mounted.delete(id)
    })
  }
}

function overlayCallbacks(fields: PackObject): OverlayCallbacks {
  const callback = (key: string) =>
    fields.optional(key, isCallback, 'a function')
  return {
    draw: fields.required('draw', isCallback, 'a function'),
    onPointerDown: callback('onPointerDown'),
    onPointerMove: callback('onPointerMove'),
    onPointerUp: callback('onPointerUp'),
    onPointerCancel: callback('onPointerCancel'),
    onKeyDown: callback('onKeyDown')
  }
}

function overlayHandle(
  state: OverlayState,
  surface: ReturnType<typeof createOverlaySurface>,
  unmount: () => void
): GraphOverlayHandle {
  const flag = (method: string, value: unknown) => {
    if (isBoolean(value)) return value
    throw invalidArgument(`${MEMBER}(...).${method}`, 'a boolean', value)
  }
  let removed = false
  return Object.freeze({
    redraw: () => surface.requestDraw(),
    setInteractive(interactive: unknown) {
      state.interactive = flag('setInteractive', interactive)
    },
    setVisible(visible: unknown) {
      state.visible = flag('setVisible', visible)
      surface.show(state.visible)
    },
    setHitRegions(regions: unknown) {
      state.regions = readHitRegions(`${MEMBER}(...).setHitRegions`, regions)
    },
    remove() {
      if (removed) return
      removed = true
      unmount()
      surface.detach()
    }
  })
}

function overlayElement(id: string, ariaLabel: string): HTMLCanvasElement {
  const element = document.createElement('canvas')
  element.dataset.graphOverlay = id
  element.tabIndex = -1
  element.setAttribute('role', 'application')
  element.setAttribute('aria-label', ariaLabel)
  Object.assign(element.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '1',
    pointerEvents: 'none'
  })
  return element
}

function afterForeground(canvas: LGraphCanvas, drawn: () => void) {
  const previous = canvas.onDrawForeground
  let chained = true
  const handler: DrawForeground = (context, area) => {
    previous?.call(canvas, context, area)
    if (chained) drawn()
  }
  canvas.onDrawForeground = handler
  return () => {
    chained = false
    if (canvas.onDrawForeground === handler) canvas.onDrawForeground = previous
  }
}
