import type * as VueI18n from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useGroupMenuOptions } from '@/composables/graph/useGroupMenuOptions'

const { canvas, captureCanvasState, refreshCanvas, settings } = vi.hoisted(
  () => ({
    canvas: { setDirty: vi.fn() },
    captureCanvasState: vi.fn(),
    refreshCanvas: vi.fn(),
    settings: { 'Comfy.GroupSelectedNodes.Padding': 10 } as Record<
      string,
      unknown
    >
  })
)

vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof VueI18n>()),
  useI18n: () => ({ t: (key: string) => key })
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
    isLightTheme: { value: false }
  })
}))

function group(over: Record<string, unknown> = {}): LGraphGroup {
  return {
    recomputeInsideNodes: vi.fn(),
    resizeTo: vi.fn(),
    children: [],
    graph: { change: vi.fn() },
    nodes: [],
    ...over
  } as unknown as LGraphGroup
}

beforeEach(() => {
  canvas.setDirty.mockReset()
  captureCanvasState.mockReset()
  refreshCanvas.mockReset()
})

describe('useGroupMenuOptions', () => {
  it('fits a group to its nodes, resizing with the configured padding', () => {
    const g = group()
    useGroupMenuOptions().getFitGroupToNodesOption(g).action?.()

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
    useGroupMenuOptions().getFitGroupToNodesOption(g).action?.()

    expect(g.resizeTo).not.toHaveBeenCalled()
  })

  it('applies a shape to all group nodes via the shape submenu', () => {
    const node = { shape: 0, mode: LGraphEventMode.ALWAYS }
    const bump = vi.fn()
    const option = useGroupMenuOptions().getGroupShapeOptions(
      group({ nodes: [node] }),
      bump
    )
    option.submenu?.[0].action?.()

    expect(node.shape).toBe(1)
    expect(refreshCanvas).toHaveBeenCalled()
    expect(bump).toHaveBeenCalled()
  })

  it('applies a color to the group via the color submenu (dark theme)', () => {
    const g = group()
    const bump = vi.fn()
    useGroupMenuOptions().getGroupColorOptions(g, bump).submenu?.[0].action?.()

    expect((g as unknown as { color: string }).color).toBe('#111')
    expect(bump).toHaveBeenCalled()
  })

  it('returns no mode options for an empty group', () => {
    expect(useGroupMenuOptions().getGroupModeOptions(group(), vi.fn())).toEqual(
      []
    )
  })

  it('builds mode options for uniform nodes and applies the new mode', () => {
    const node = { shape: 0, mode: LGraphEventMode.ALWAYS }
    const bump = vi.fn()
    const options = useGroupMenuOptions().getGroupModeOptions(
      group({ nodes: [node] }),
      bump
    )

    expect(options.length).toBeGreaterThan(0)
    options[0].action?.()
    expect(node.mode).not.toBe(LGraphEventMode.ALWAYS)
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    expect(bump).toHaveBeenCalled()
  })

  it('offers two alternate modes when all nodes are NEVER', () => {
    const options = useGroupMenuOptions().getGroupModeOptions(
      group({ nodes: [{ mode: LGraphEventMode.NEVER }] }),
      vi.fn()
    )
    expect(options).toHaveLength(2)
  })

  it('offers two alternate modes when all nodes are BYPASS', () => {
    const options = useGroupMenuOptions().getGroupModeOptions(
      group({ nodes: [{ mode: LGraphEventMode.BYPASS }] }),
      vi.fn()
    )
    expect(options).toHaveLength(2)
  })

  it('offers all three modes when nodes have mixed modes', () => {
    const options = useGroupMenuOptions().getGroupModeOptions(
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
})
