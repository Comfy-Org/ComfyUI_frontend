import type * as VueI18n from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { useNodeCustomization } from '@/composables/graph/useNodeCustomization'

const { selection, refreshCanvas, palette } = vi.hoisted(() => ({
  selection: { items: [] as unknown[] },
  refreshCanvas: vi.fn(),
  palette: { light_theme: false }
}))

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof VueI18n>()),
  useI18n: () => ({ t: (key: string) => key })
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
    const { colorOptions, shapeOptions } = useNodeCustomization()
    expect(colorOptions.length).toBeGreaterThan(1)
    expect(shapeOptions.length).toBeGreaterThan(0)
  })

  it('reflects the active palette light-theme flag', () => {
    palette.light_theme = true
    expect(useNodeCustomization().isLightTheme.value).toBe(true)
  })

  it('clears color on all colorable items for the no-color option', () => {
    const item = colorable()
    selection.items = [item]
    useNodeCustomization().applyColor(null)

    expect(item.setColorOption).toHaveBeenCalledWith(null)
    expect(refreshCanvas).toHaveBeenCalled()
  })

  it('applies a named color option to colorable items', () => {
    const item = colorable()
    selection.items = [item]
    const { colorOptions, applyColor } = useNodeCustomization()
    // Options are built from LGraphCanvas.node_colors, so the last one is a
    // real named color that resolves to a non-null canvas color option.
    const named = colorOptions.at(-1)!

    applyColor(named)

    expect(item.setColorOption).toHaveBeenCalledTimes(1)
    expect(item.setColorOption.mock.calls[0][0]).not.toBeNull()
  })

  it('returns null current color for an empty selection', () => {
    expect(useNodeCustomization().getCurrentColor()).toBeNull()
  })

  it('falls back to the no-color option for an unrecognized current color', () => {
    selection.items = [colorable('#not-a-known-color')]
    const result = useNodeCustomization().getCurrentColor()
    expect(result?.name).toBeDefined()
  })

  it('no-ops shape changes when no graph nodes are selected', () => {
    selection.items = [colorable()] // colorable but not an LGraphNode
    useNodeCustomization().applyShape({ name: 'box', value: 'box' } as never)
    expect(refreshCanvas).not.toHaveBeenCalled()
  })

  it('returns null current shape with no nodes selected', () => {
    expect(useNodeCustomization().getCurrentShape()).toBeNull()
  })

  it('applies a shape to selected graph nodes and refreshes', () => {
    const node = new LGraphNode('Test')
    selection.items = [node]
    const { applyShape, shapeOptions } = useNodeCustomization()
    const target = shapeOptions[0]

    applyShape(target)

    expect(node.shape).toBe(target.value)
    expect(refreshCanvas).toHaveBeenCalled()
  })

  it('reports the current shape of a selected node', () => {
    const node = new LGraphNode('Test')
    const { shapeOptions, getCurrentShape } = useNodeCustomization()
    node.shape = shapeOptions[0].value
    selection.items = [node]

    expect(getCurrentShape()?.value).toBe(shapeOptions[0].value)
  })
})
