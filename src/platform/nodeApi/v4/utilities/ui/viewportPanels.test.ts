import { reportError } from '@comfyorg/telemetry/reportError'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { CanvasSource } from '@/platform/nodeApi/v4/canvasSource'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import type { ViewportPanelDef } from '@/platform/nodeApi/v4/types'

let canvasSource: CanvasSource | undefined

function uiApi() {
  return createComfyApi({ getGraph: () => null, canvas: () => canvasSource })
    .comfy.ui
}

function graphViewSource(): { view: HTMLElement; source: CanvasSource } {
  const view = document.createElement('div')
  const canvas = document.createElement('canvas')
  view.append(canvas)
  document.body.append(view)
  onTestFinished(() => view.remove())
  const source = fromPartial<CanvasSource>({
    canvas: () => fromPartial<LGraphCanvas>({ canvas })
  })
  return { view, source }
}

function showGraphView(): HTMLElement {
  const { view, source } = graphViewSource()
  canvasSource = source
  onTestFinished(() => {
    canvasSource = undefined
  })
  return view
}

function panel(overrides: Partial<ViewportPanelDef> = {}): ViewportPanelDef {
  return {
    id: 'MyPack.progress',
    ariaLabel: 'Progress',
    render: vi.fn((container: HTMLElement) => {
      container.textContent = 'pack panel'
    }),
    destroy: vi.fn(),
    ...overrides
  }
}

function mountedPanel(view: HTMLElement, id: string): HTMLElement {
  const found = view.querySelector<HTMLElement>(`[data-viewport-panel="${id}"]`)
  assert(found, `no panel ${id}`)
  return found
}

describe('viewport panels', () => {
  it('mounts a named region over the graph view and renders into it while in the document', () => {
    const view = showGraphView()
    let renderedInDocument = false
    const definition = panel({
      render: vi.fn((container: HTMLElement) => {
        renderedInDocument = container.isConnected
        container.textContent = 'pack panel'
      })
    })

    uiApi().mountViewportPanel(definition)

    expect(renderedInDocument).toBe(true)
    const mounted = mountedPanel(view, 'MyPack.progress')
    expect(mounted.getAttribute('role')).toBe('region')
    expect(mounted.getAttribute('aria-label')).toBe('Progress')
    expect(mounted.textContent).toBe('pack panel')
    expect(definition.render).toHaveBeenCalledOnce()
  })

  it.for([
    { anchor: undefined, style: { top: '0px', left: '0px' } },
    { anchor: 'top-right', style: { top: '4px', right: '12px' } },
    { anchor: 'bottom-left', style: { bottom: '4px', left: '12px' } },
    {
      anchor: 'bottom-center',
      style: {
        bottom: '4px',
        left: '50%',
        transform: 'translateX(calc(-50% + 12px))'
      }
    }
  ] as const)(
    'places a $anchor panel against its edge',
    ({ anchor, style }) => {
      const view = showGraphView()
      const offsets = anchor === undefined ? {} : { offsetX: 12, offsetY: 4 }

      uiApi().mountViewportPanel(panel({ anchor, ...offsets }))

      expect(mountedPanel(view, 'MyPack.progress').style).toMatchObject({
        position: 'absolute',
        ...style
      })
    }
  )

  it('sizes the panel as asked', () => {
    const view = showGraphView()

    uiApi().mountViewportPanel(panel({ width: 600, maxHeight: 160 }))

    expect(mountedPanel(view, 'MyPack.progress').style).toMatchObject({
      width: '600px',
      maxHeight: '160px'
    })
  })

  it('calls destroy once while the panel is still in the document, then removes it', () => {
    const view = showGraphView()
    let destroyedInDocument = false
    const definition = panel({
      destroy: vi.fn(() => {
        destroyedInDocument =
          view.querySelector('[data-viewport-panel]') !== null
      })
    })
    const handle = uiApi().mountViewportPanel(definition)

    handle?.remove()
    handle?.remove()

    expect(destroyedInDocument).toBe(true)
    expect(view.querySelector('[data-viewport-panel]')).toBeNull()
    expect(definition.destroy).toHaveBeenCalledOnce()
  })

  it('calls destroy on remove even after the graph view was taken down', () => {
    const view = showGraphView()
    const definition = panel()
    const handle = uiApi().mountViewportPanel(definition)
    view.remove()

    handle?.remove()

    expect(definition.destroy).toHaveBeenCalledOnce()
  })

  it('refuses an id already mounted, and frees it once the panel is removed', () => {
    const view = showGraphView()
    const ui = uiApi()
    const first = ui.mountViewportPanel(panel())

    expect(() => ui.mountViewportPanel(panel())).toThrow(
      new TypeError(
        "ui.mountViewportPanel needs an id no mounted panel has, not 'MyPack.progress'."
      )
    )
    expect(view.querySelectorAll('[data-viewport-panel]')).toHaveLength(1)
    first?.remove()
    ui.mountViewportPanel(panel())
    expect(view.querySelectorAll('[data-viewport-panel]')).toHaveLength(1)
  })

  it('keeps a later panel under the same id when an old handle is removed again', () => {
    const view = showGraphView()
    const ui = uiApi()
    const old = ui.mountViewportPanel(panel())
    old?.remove()
    ui.mountViewportPanel(panel())

    old?.remove()

    expect(view.querySelectorAll('[data-viewport-panel]')).toHaveLength(1)
    expect(() => ui.mountViewportPanel(panel())).toThrow(TypeError)
  })

  it('mounts over the canvas the renderer gives the app', () => {
    const { view, source } = graphViewSource()
    const store = useComfyApiStore()
    store.provideCanvas(source)
    store.publish()

    window.comfy_v4?.ui.mountViewportPanel(panel())

    expect(mountedPanel(view, 'MyPack.progress').textContent).toBe('pack panel')
  })

  it('mounts nothing and gives undefined before the renderer has a canvas', () => {
    const definition = panel()

    expect(uiApi().mountViewportPanel(definition)).toBeUndefined()
    expect(definition.render).not.toHaveBeenCalled()
  })

  it('reports a render that throws, and can still be removed', () => {
    const view = showGraphView()
    const broken = new Error('pack render failed')
    const handle = uiApi().mountViewportPanel(
      panel({
        render: () => {
          throw broken
        }
      })
    )

    handle?.remove()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'ui.mountViewportPanel' } })
    )
    expect(view.querySelector('[data-viewport-panel]')).toBeNull()
  })

  it.for([
    { name: 'no panel', value: 7, needs: 'a viewport panel' },
    {
      name: 'an empty id',
      value: panel({ id: '' }),
      needs: 'id as a non-empty string'
    },
    {
      name: 'no accessible name',
      value: { ...panel(), ariaLabel: undefined },
      needs: 'ariaLabel as a non-empty string'
    },
    {
      name: 'an unknown anchor',
      value: { ...panel(), anchor: 'middle' },
      needs:
        'anchor as top-left, top-center, top-right, bottom-left, bottom-center, bottom-right'
    },
    {
      name: 'an offset that is not finite',
      value: panel({ offsetX: Number.NaN }),
      needs: 'offsetX as a finite number'
    },
    {
      name: 'an infinite vertical offset',
      value: panel({ offsetY: Infinity }),
      needs: 'offsetY as a finite number'
    },
    {
      name: 'an offset given as text',
      value: { ...panel(), offsetY: '6' },
      needs: 'offsetY as a finite number'
    },
    {
      name: 'a width of zero',
      value: panel({ width: 0 }),
      needs: 'width as a positive finite number'
    },
    {
      name: 'a negative height',
      value: panel({ maxHeight: -1 }),
      needs: 'maxHeight as a positive finite number'
    },
    {
      name: 'no render function',
      value: { ...panel(), render: null },
      needs: 'render as a function'
    },
    {
      name: 'a destroy that is not a function',
      value: { ...panel(), destroy: 1 },
      needs: 'destroy as a function'
    }
  ])('refuses $name, and mounts nothing', ({ value, needs }) => {
    const view = showGraphView()
    const ui = uiApi()

    expect(() => Reflect.apply(ui.mountViewportPanel, ui, [value])).toThrow(
      expect.objectContaining({
        name: 'TypeError',
        message: expect.stringContaining(
          `ui.mountViewportPanel needs ${needs}, not `
        )
      })
    )
    expect(view.querySelector('[data-viewport-panel]')).toBeNull()
  })
})
