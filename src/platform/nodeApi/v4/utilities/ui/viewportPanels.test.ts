import { reportError } from '@comfyorg/telemetry/reportError'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { CanvasSource } from '@/platform/nodeApi/v4/canvasSource'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import type { ViewportPanelDef } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

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

function appBeforeGraphView() {
  const views: HTMLElement[] = []
  const graphCanvas = shallowRef<LGraphCanvas | null>(null)
  canvasSource = fromPartial<CanvasSource>({ canvas: () => graphCanvas.value })
  onTestFinished(() => {
    canvasSource = undefined
  })
  return {
    showCanvasOutsideView() {
      graphCanvas.value = fromPartial<LGraphCanvas>({
        canvas: document.createElement('canvas')
      })
    },
    showGraphView() {
      const { view, source } = graphViewSource()
      views.push(view)
      graphCanvas.value = source.canvas()
      return view
    },
    get firstView() {
      const [first] = views
      assert(first, 'no graph view shown yet')
      return first
    }
  }
}

function panel(overrides: Partial<ViewportPanelDef> = {}): ViewportPanelDef {
  return {
    id: 'MyPack.progress',
    ariaLabel: 'Progress',
    render: vi.fn((container: HTMLElement) => {
      container.textContent = 'pack panel'
    }),
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
    expect(mounted.parentElement).toBe(view)
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

  it('removes the panel when the disposer is called, and once only', () => {
    const view = showGraphView()
    const remove = uiApi().mountViewportPanel(panel())

    remove()
    remove()

    expect(view.querySelector('[data-viewport-panel]')).toBeNull()
  })

  it('refuses a destroy field: the pack tears its content down itself', () => {
    showGraphView()

    expect(() =>
      uiApi().mountViewportPanel({
        ...panel(),
        destroy: () => {}
      } as ViewportPanelDef)
    ).toThrow(
      "ui.mountViewportPanel needs a viewport panel of id, ariaLabel, anchor, offsetX, offsetY, width, maxHeight, render only, not 'destroy'."
    )
  })

  it('refuses an id already mounted, and frees it once the panel is removed', () => {
    const view = showGraphView()
    const ui = uiApi()
    const removeFirst = ui.mountViewportPanel(panel())

    expect(() => ui.mountViewportPanel(panel())).toThrow(
      new TypeError(
        "ui.mountViewportPanel needs an id no mounted panel has, not 'MyPack.progress'."
      )
    )
    expect(view.querySelectorAll('[data-viewport-panel]')).toHaveLength(1)
    removeFirst()
    ui.mountViewportPanel(panel())
    expect(view.querySelectorAll('[data-viewport-panel]')).toHaveLength(1)
  })

  it('keeps a later panel under the same id when an old handle is removed again', () => {
    const view = showGraphView()
    const ui = uiApi()
    const removeOld = ui.mountViewportPanel(panel())
    removeOld()
    ui.mountViewportPanel(panel())

    removeOld()

    expect(view.querySelectorAll('[data-viewport-panel]')).toHaveLength(1)
    expectRefusal(() => ui.mountViewportPanel(panel()), 'ui.mountViewportPanel')
  })

  it('mounts over the canvas the renderer gives the app', () => {
    const { view, source } = graphViewSource()
    const store = useComfyApiStore()
    store.provideCanvas(source)
    store.publish()

    window.comfy_v4?.ui.mountViewportPanel(panel())

    expect(mountedPanel(view, 'MyPack.progress').textContent).toBe('pack panel')
  })

  it('waits for the renderer to give a canvas, then mounts and renders over it once', () => {
    const app = appBeforeGraphView()
    const definition = panel()

    const remove = uiApi().mountViewportPanel(definition)
    expect(definition.render).not.toHaveBeenCalled()
    app.showGraphView()
    const later = app.showGraphView()

    expect(mountedPanel(app.firstView, 'MyPack.progress').textContent).toBe(
      'pack panel'
    )
    expect(later.querySelector('[data-viewport-panel]')).toBeNull()
    expect(definition.render).toHaveBeenCalledOnce()
    remove()
    expect(app.firstView.querySelector('[data-viewport-panel]')).toBeNull()
  })

  it('keeps waiting through a canvas that is in no view yet', () => {
    const app = appBeforeGraphView()
    const definition = panel()
    uiApi().mountViewportPanel(definition)

    app.showCanvasOutsideView()
    expect(definition.render).not.toHaveBeenCalled()
    app.showGraphView()

    expect(mountedPanel(app.firstView, 'MyPack.progress').textContent).toBe(
      'pack panel'
    )
    expect(definition.render).toHaveBeenCalledOnce()
  })

  it('renders nothing for a panel removed before the renderer gave a canvas, and frees its id', () => {
    const app = appBeforeGraphView()
    const ui = uiApi()
    const definition = panel()
    const remove = ui.mountViewportPanel(definition)

    remove()
    app.showGraphView()

    expect(app.firstView.querySelector('[data-viewport-panel]')).toBeNull()
    expect(definition.render).not.toHaveBeenCalled()
    ui.mountViewportPanel(panel())
    expect(mountedPanel(app.firstView, 'MyPack.progress')).toBeTruthy()
  })

  it('refuses an id waiting for the graph view, as one already mounted', () => {
    const app = appBeforeGraphView()
    const ui = uiApi()
    ui.mountViewportPanel(panel())

    expectRefusal(() => ui.mountViewportPanel(panel()), 'ui.mountViewportPanel')
    app.showGraphView()
    expect(
      app.firstView.querySelectorAll('[data-viewport-panel]')
    ).toHaveLength(1)
  })

  it('reports a render that throws, and can still be removed', () => {
    const view = showGraphView()
    const broken = new Error('pack render failed')
    const remove = uiApi().mountViewportPanel(
      panel({
        render: () => {
          throw broken
        }
      })
    )

    remove()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'ui.mountViewportPanel' } })
    )
    expect(view.querySelector('[data-viewport-panel]')).toBeNull()
  })

  it.for([
    { name: 'no panel', value: 7, needs: 'a viewport panel as a plain object' },
    {
      name: 'a field a panel does not have',
      value: { ...panel(), height: 40 },
      needs:
        'a viewport panel of id, ariaLabel, anchor, offsetX, offsetY, width, maxHeight, render only'
    },
    {
      name: 'a panel made by a class',
      value: Object.assign(new (class Panel {})(), panel()),
      needs: 'a viewport panel as a plain object'
    },
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
