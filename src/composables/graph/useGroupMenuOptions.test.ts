import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import type { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useGroupMenuOptions } from '@/composables/graph/useGroupMenuOptions'

const { canvas, captureCanvasState, isLightTheme, refreshCanvas, settings } =
  vi.hoisted(() => ({
    canvas: { setDirty: vi.fn() },
    captureCanvasState: vi.fn(),
    isLightTheme: { value: false },
    refreshCanvas: vi.fn(),
    settings: { 'Comfy.GroupSelectedNodes.Padding': 10 } as Record<
      string,
      unknown
    >
  }))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: (k: string) => settings[k] })
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: { changeTracker: { captureCanvasState } }
  })
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas })
}))
vi.mock('@/composables/graph/useCanvasRefresh', () => ({
  useCanvasRefresh: () => ({ refreshCanvas })
}))
vi.mock('@/composables/graph/useNodeCustomization', () => ({
  useNodeCustomization: () => ({
    shapeOptions: [{ value: 1, localizedName: 'Box' }],
    colorOptions: [
      { value: { dark: '#111', light: '#eee' }, localizedName: 'Red' }
    ],
    isLightTheme
  })
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

function setup() {
  return withI18n(() => useGroupMenuOptions())
}

function group(over: Record<string, unknown> = {}): LGraphGroup {
  return fromPartial<LGraphGroup>({
    recomputeInsideNodes: vi.fn(),
    resizeTo: vi.fn(),
    children: [],
    graph: { change: vi.fn() },
    nodes: [],
    ...over
  })
}

beforeEach(() => {
  canvas.setDirty.mockReset()
  captureCanvasState.mockReset()
  isLightTheme.value = false
  refreshCanvas.mockReset()
})

describe('useGroupMenuOptions', () => {
  it('fits a group to its nodes, resizing with the configured padding', () => {
    const g = group()
    setup().getFitGroupToNodesOption(g).action?.()

    expect(g.recomputeInsideNodes).toHaveBeenCalled()
    expect(g.resizeTo).toHaveBeenCalledWith(g.children, 10)
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    expect(captureCanvasState).toHaveBeenCalled()
  })

  it('aborts the fit action when recompute throws', () => {
    const g = group({
      recomputeInsideNodes: vi.fn(() => {
        throw new Error('boom')
      })
    })
    setup().getFitGroupToNodesOption(g).action?.()

    expect(g.resizeTo).not.toHaveBeenCalled()
  })

  it('applies a shape to all group nodes via the shape submenu', () => {
    const node = { shape: 0, mode: LGraphEventMode.ALWAYS }
    const bump = vi.fn()
    const option = setup().getGroupShapeOptions(group({ nodes: [node] }), bump)
    option.submenu?.[0].action?.()

    expect(node.shape).toBe(1)
    expect(refreshCanvas).toHaveBeenCalled()
    expect(bump).toHaveBeenCalled()
  })

  it('handles shape actions when a group has no nodes array', () => {
    const bump = vi.fn()
    setup()
      .getGroupShapeOptions(group({ nodes: undefined }), bump)
      .submenu?.[0].action?.()

    expect(refreshCanvas).toHaveBeenCalled()
    expect(bump).toHaveBeenCalled()
  })

  it('applies a color to the group via the color submenu (dark theme)', () => {
    const g = group()
    const bump = vi.fn()
    setup().getGroupColorOptions(g, bump).submenu?.[0].action?.()

    expect(g.color).toBe('#111')
    expect(bump).toHaveBeenCalled()
  })

  it('applies a light-theme color to the group via the color submenu', () => {
    const g = group()
    const bump = vi.fn()
    isLightTheme.value = true
    setup().getGroupColorOptions(g, bump).submenu?.[0].action?.()

    expect(g.color).toBe('#eee')
    expect(bump).toHaveBeenCalled()
  })

  it('returns no mode options for an empty group', () => {
    expect(setup().getGroupModeOptions(group(), vi.fn())).toEqual([])
  })

  it('returns no mode options when a group has no nodes array', () => {
    expect(
      setup().getGroupModeOptions(group({ nodes: undefined }), vi.fn())
    ).toEqual([])
  })

  it('returns no mode options when recomputing group nodes fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const options = setup().getGroupModeOptions(
      group({
        recomputeInsideNodes: vi.fn(() => {
          throw new Error('boom')
        })
      }),
      vi.fn()
    )

    expect(options).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to recompute nodes in group for mode options:',
      expect.any(Error)
    )
  })

  it('builds mode options for uniform nodes and applies the new mode', () => {
    const node = { shape: 0, mode: LGraphEventMode.ALWAYS }
    const bump = vi.fn()
    const options = setup().getGroupModeOptions(group({ nodes: [node] }), bump)

    expect(options.length).toBeGreaterThan(0)
    options[0].action?.()
    expect(node.mode).not.toBe(LGraphEventMode.ALWAYS)
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    expect(bump).toHaveBeenCalled()
  })

  it('offers two alternate modes when all nodes are NEVER', () => {
    const options = setup().getGroupModeOptions(
      group({ nodes: [{ mode: LGraphEventMode.NEVER }] }),
      vi.fn()
    )
    expect(options).toHaveLength(2)
  })

  it('offers two alternate modes when all nodes are BYPASS', () => {
    const options = setup().getGroupModeOptions(
      group({ nodes: [{ mode: LGraphEventMode.BYPASS }] }),
      vi.fn()
    )
    expect(options).toHaveLength(2)
  })

  it('offers all three modes when nodes have mixed modes', () => {
    const options = setup().getGroupModeOptions(
      group({
        nodes: [
          { mode: LGraphEventMode.ALWAYS },
          { mode: LGraphEventMode.NEVER }
        ]
      }),
      vi.fn()
    )
    expect(options).toHaveLength(3)
  })

  it('offers all three modes when the uniform mode is unknown', () => {
    const options = setup().getGroupModeOptions(
      group({ nodes: [{ mode: 999 }] }),
      vi.fn()
    )
    expect(options).toHaveLength(3)
  })
})
