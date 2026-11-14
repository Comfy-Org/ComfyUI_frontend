import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { ComfyApiError } from './errors'
import { createUiHandle } from './uiHandle'
import type { ViewportPanelDef } from './viewportPanel'

describe('viewport panels', () => {
  let view: HTMLElement
  const ui = createUiHandle()

  beforeEach(() => {
    view = document.createElement('div')
    const canvas = document.createElement('canvas')
    canvas.id = 'graph-canvas'
    view.append(canvas)
    document.body.append(view)
    onTestFinished(() => view.remove())
  })

  function mount(def: Partial<ViewportPanelDef> = {}) {
    const handle = ui.mountViewportPanel({
      id: 'Pack.tools',
      render: () => {},
      ...def
    })
    onTestFinished(handle.remove)
    return handle
  }
  const panel = () =>
    view.querySelector<HTMLElement>('[data-viewport-panel="Pack.tools"]')!

  it('mounts a labelled region in the graph view and lets the pack fill it', () => {
    mount({
      ariaLabel: 'Pack tools',
      render: (container) => container.append(document.createElement('button'))
    })

    expect(panel().parentElement).toBe(view)
    expect(panel().getAttribute('role')).toBe('region')
    expect(panel().getAttribute('aria-label')).toBe('Pack tools')
    expect(panel().querySelector('button')).not.toBeNull()
  })

  it('hands render a container that is already in the document', () => {
    const connected = vi.fn((container: HTMLElement) => container.isConnected)

    mount({ render: connected })

    expect(connected).toHaveReturnedWith(true)
  })

  it.for([
    {
      name: 'the bottom centre',
      def: { anchor: 'bottom-center', offsetX: 5, offsetY: 16 },
      style: {
        bottom: '16px',
        left: '50%',
        transform: 'translateX(calc(-50% + 5px))',
        top: '',
        right: ''
      }
    },
    {
      name: 'the bottom right corner',
      def: { anchor: 'bottom-right', offsetX: 12, offsetY: 240 },
      style: {
        bottom: '240px',
        right: '12px',
        top: '',
        left: '',
        transform: ''
      }
    },
    {
      name: 'the top left corner by default',
      def: {},
      style: { top: '0px', left: '0px', bottom: '', right: '', transform: '' }
    }
  ] as const)('places the panel against $name', ({ def, style }) => {
    mount(def)

    expect(panel().style.position).toBe('absolute')
    expect(panel().style).toMatchObject(style)
  })

  it('applies the width and height limit it is given', () => {
    mount({ width: 720, maxHeight: 180 })

    expect(panel().style).toMatchObject({
      width: '720px',
      maxHeight: '180px',
      maxWidth: '100%',
      overflow: 'auto'
    })
  })

  it('removes the panel and tells the pack once', () => {
    const destroy = vi.fn()
    const handle = mount({ destroy })

    handle.remove()
    handle.remove()

    expect(view.querySelector('[data-viewport-panel]')).toBeNull()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('leaves nothing behind when render throws', () => {
    expect(() =>
      mount({
        render: () => {
          throw new Error('render failed')
        }
      })
    ).toThrow('render failed')
    expect(view.querySelector('[data-viewport-panel]')).toBeNull()
  })

  it('refuses to mount when no graph view is open', () => {
    view.remove()

    expect(() => mount()).toThrow(ComfyApiError)
  })

  it.for([
    { name: 'a blank id', def: { id: ' ' } },
    { name: 'an unknown anchor', def: { anchor: 'middle' } },
    { name: 'a size that is not finite', def: { width: Number.NaN } }
  ])('refuses $name and mounts nothing', ({ def }) => {
    expect(() =>
      Reflect.apply(ui.mountViewportPanel, ui, [
        { id: 'Pack.tools', render: () => {}, ...def }
      ])
    ).toThrow(ComfyApiError)
    expect(view.querySelector('[data-viewport-panel]')).toBeNull()
  })
})
