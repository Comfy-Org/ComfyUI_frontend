import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'

const { selection, refreshCanvas, palette } = vi.hoisted(() => ({
  selection: { items: [] as unknown[] },
  refreshCanvas: vi.fn(),
  palette: { light_theme: false }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    get selectedItems() {
      return selection.items
    }
  })
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    get completedActivePalette() {
      return { light_theme: palette.light_theme }
    }
  })
}))

vi.mock('@/composables/graph/useCanvasRefresh', () => ({
  useCanvasRefresh: () => ({ refreshCanvas })
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function withI18n<T>(fn: () => T): T {
  let result!: T
  const app = createApp(
    defineComponent({
      setup() {
        result = fn()
        return () => null
      }
    })
  )
  app.use(i18n)
  app.mount(document.createElement('div'))
  return result
}

function colorable(bgcolor?: string) {
  return {
    setColorOption: vi.fn(),
    getColorOption: () => (bgcolor ? { bgcolor } : null)
  }
}

beforeEach(() => {
  selection.items = []
  refreshCanvas.mockReset()
  palette.light_theme = false
})

describe('useNodeCustomization', () => {
  it('exposes color and shape option lists', () => {
    const { colorOptions, shapeOptions } = withI18n(() =>
      useNodeCustomization()
    )
    expect(colorOptions.length).toBeGreaterThan(1)
    expect(shapeOptions.length).toBeGreaterThan(0)
  })

  it('reflects the active palette light-theme flag', () => {
    palette.light_theme = true
    expect(withI18n(() => useNodeCustomization()).isLightTheme.value).toBe(true)
  })

  it('clears color on all colorable items for the no-color option', () => {
    const item = colorable()
    selection.items = [item]
    withI18n(() => useNodeCustomization()).applyColor(null)

    expect(item.setColorOption).toHaveBeenCalledWith(null)
    expect(refreshCanvas).toHaveBeenCalled()
  })

  it('applies a named color option to colorable items', () => {
    const item = colorable()
    selection.items = [item]
    const { colorOptions, applyColor } = withI18n(() => useNodeCustomization())
    const named = colorOptions.at(-1)!

    applyColor(named)

    expect(item.setColorOption).toHaveBeenCalledTimes(1)
    expect(item.setColorOption.mock.calls[0][0]).not.toBeNull()
  })

  it('skips non-colorable items when applying colors', () => {
    const item = colorable()
    selection.items = [{}, item]

    withI18n(() => useNodeCustomization()).applyColor(null)

    expect(item.setColorOption).toHaveBeenCalledWith(null)
    expect(refreshCanvas).toHaveBeenCalled()
  })

  it('returns null current color for an empty selection', () => {
    expect(withI18n(() => useNodeCustomization()).getCurrentColor()).toBeNull()
  })

  it('returns null current color when no selected item is colorable', () => {
    selection.items = [{}]
    expect(withI18n(() => useNodeCustomization()).getCurrentColor()).toBeNull()
  })

  it('reports a recognized current color', () => {
    const { colorOptions, getCurrentColor } = withI18n(() =>
      useNodeCustomization()
    )
    const named = colorOptions.at(-1)!
    selection.items = [colorable(named.value.dark)]

    expect(getCurrentColor()?.name).toBe(named.name)
  })

  it('falls back to the no-color option for an unrecognized current color', () => {
    selection.items = [colorable('#not-a-known-color')]
    const result = withI18n(() => useNodeCustomization()).getCurrentColor()
    expect(result?.name).toBe('noColor')
  })

  it('no-ops shape changes when no graph nodes are selected', () => {
    selection.items = [colorable()]
    const { applyShape, shapeOptions } = withI18n(() => useNodeCustomization())
    applyShape(shapeOptions[0])
    expect(refreshCanvas).not.toHaveBeenCalled()
  })

  it('returns null current shape with no nodes selected', () => {
    expect(withI18n(() => useNodeCustomization()).getCurrentShape()).toBeNull()
  })

  it('applies a shape to selected graph nodes and refreshes', () => {
    const node = new LGraphNode('Test')
    selection.items = [node]
    const { applyShape, shapeOptions } = withI18n(() => useNodeCustomization())
    const target = shapeOptions[0]

    applyShape(target)

    expect(node.shape).toBe(target.value)
    expect(refreshCanvas).toHaveBeenCalled()
  })

  it('reports the current shape of a selected node', () => {
    const node = new LGraphNode('Test')
    const { shapeOptions, getCurrentShape } = withI18n(() =>
      useNodeCustomization()
    )
    node.shape = shapeOptions[0].value
    selection.items = [node]

    expect(getCurrentShape()?.value).toBe(shapeOptions[0].value)
  })

  it('uses the default shape when a selected node has no shape', () => {
    const node = new LGraphNode('Test')
    Object.defineProperty(node, 'shape', {
      value: undefined,
      writable: true,
      configurable: true
    })
    const { shapeOptions, getCurrentShape } = withI18n(() =>
      useNodeCustomization()
    )
    selection.items = [node]

    expect(getCurrentShape()?.value).toBe(shapeOptions[0].value)
  })

  it('falls back to the default shape for an unknown node shape', () => {
    const node = new LGraphNode('Test')
    Object.defineProperty(node, 'shape', {
      value: 999,
      writable: true,
      configurable: true
    })
    const { shapeOptions, getCurrentShape } = withI18n(() =>
      useNodeCustomization()
    )
    selection.items = [node]

    expect(getCurrentShape()?.value).toBe(shapeOptions[0].value)
  })
})
