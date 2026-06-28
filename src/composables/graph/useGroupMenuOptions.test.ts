import type * as VueI18n from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    isLightTheme
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
  isLightTheme.value = false
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

  it('handles shape actions when a group has no nodes array', () => {
    const bump = vi.fn()
    useGroupMenuOptions()
      .getGroupShapeOptions(group({ nodes: undefined }), bump)
      .submenu?.[0].action?.()

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

  it('applies a light-theme color to the group via the color submenu', () => {
    const g = group()
    const bump = vi.fn()
    isLightTheme.value = true
    useGroupMenuOptions().getGroupColorOptions(g, bump).submenu?.[0].action?.()

    expect((g as unknown as { color: string }).color).toBe('#eee')
    expect(bump).toHaveBeenCalled()
  })

  it('returns no mode options for an empty group', () => {
    expect(useGroupMenuOptions().getGroupModeOptions(group(), vi.fn())).toEqual(
      []
    )
  })

  it('returns no mode options when a group has no nodes array', () => {
    expect(
      useGroupMenuOptions().getGroupModeOptions(
        group({ nodes: undefined }),
        vi.fn()
      )
    ).toEqual([])
  })

  it('returns no mode options when recomputing group nodes fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const options = useGroupMenuOptions().getGroupModeOptions(
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

    warnSpy.mockRestore()
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

  it('offers all three modes when the uniform mode is unknown', () => {
    const options = useGroupMenuOptions().getGroupModeOptions(
      group({ nodes: [{ mode: 999 }] }),
      vi.fn()
    )
    expect(options).toHaveLength(3)
  })
})
