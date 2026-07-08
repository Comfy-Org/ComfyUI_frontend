import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphGroup } from '@/lib/litegraph/src/litegraph'

const mockSelectionState = vi.hoisted(() => ({
  refs: null as null | {
    hasMultipleSelection: { value: boolean }
  }
}))

const mockSettingStore = vi.hoisted(() => ({
  get: vi.fn()
}))

const mockTitleEditorStore = vi.hoisted(() => ({
  titleEditorTarget: null as null | object
}))

const mockApp = vi.hoisted(() => ({
  canvas: {
    selectedItems: new Set<object>(),
    graph: {
      add: vi.fn()
    }
  }
}))

vi.mock('@/composables/graph/useSelectionState', async () => {
  const { ref } = await import('vue')
  const hasMultipleSelection = ref(false)
  mockSelectionState.refs = {
    hasMultipleSelection
  }

  return {
    useSelectionState: () => ({
      hasMultipleSelection
    })
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useTitleEditorStore: () => mockTitleEditorStore
}))

vi.mock('@/scripts/app', () => ({
  app: mockApp
}))

describe('useFrameNodes', () => {
  let resizeToSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    if (mockSelectionState.refs) {
      mockSelectionState.refs.hasMultipleSelection.value = false
    }
    mockSettingStore.get.mockReturnValue(24)
    mockTitleEditorStore.titleEditorTarget = null
    mockApp.canvas.selectedItems = new Set()
    mockApp.canvas.graph = {
      add: vi.fn()
    }
    // Real LGraphGroup constructor; only resizeTo's own geometry math is
    // out of scope here (see LGraphGroup's own test coverage for that).
    resizeToSpy = vi
      .spyOn(LGraphGroup.prototype, 'resizeTo')
      .mockImplementation(() => {})
  })

  afterEach(() => {
    resizeToSpy.mockRestore()
  })

  it('exposes whether selected nodes can be framed', async () => {
    const { useFrameNodes } = await import('./useFrameNodes')
    const { canFrame } = useFrameNodes()

    expect(canFrame.value).toBe(false)

    if (!mockSelectionState.refs) {
      throw new Error('selection refs were not initialized')
    }
    mockSelectionState.refs.hasMultipleSelection.value = true

    expect(canFrame.value).toBe(true)
  })

  it('does nothing when no items are selected', async () => {
    const { useFrameNodes } = await import('./useFrameNodes')
    const { frameNodes } = useFrameNodes()

    frameNodes()

    expect(resizeToSpy).not.toHaveBeenCalled()
    expect(mockApp.canvas.graph.add).not.toHaveBeenCalled()
  })

  it('frames selected items and opens the title editor on the new group', async () => {
    const selectedNode = {}
    mockApp.canvas.selectedItems = new Set([selectedNode])

    const { useFrameNodes } = await import('./useFrameNodes')
    const { frameNodes } = useFrameNodes()

    frameNodes()

    const group = mockApp.canvas.graph.add.mock.calls[0]?.[0] as LGraphGroup
    expect(group).toBeInstanceOf(LGraphGroup)
    expect(resizeToSpy).toHaveBeenCalledWith(mockApp.canvas.selectedItems, 24)
    expect(mockApp.canvas.graph.add).toHaveBeenCalledWith(group)
    expect(mockTitleEditorStore.titleEditorTarget).toBe(group)
  })
})
