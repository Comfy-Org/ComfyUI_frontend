import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const mockGroups = vi.hoisted(() => ({
  instances: [] as Array<{
    resizeTo: ReturnType<typeof vi.fn>
  }>
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

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LGraphGroup: class MockLGraphGroup {
    resizeTo = vi.fn()

    constructor() {
      mockGroups.instances.push(this)
    }
  }
}))

describe('useFrameNodes', () => {
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
    mockGroups.instances = []
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

    expect(mockGroups.instances).toHaveLength(0)
    expect(mockApp.canvas.graph.add).not.toHaveBeenCalled()
  })

  it('frames selected items and opens the title editor on the new group', async () => {
    const selectedNode = {}
    mockApp.canvas.selectedItems = new Set([selectedNode])

    const { useFrameNodes } = await import('./useFrameNodes')
    const { frameNodes } = useFrameNodes()

    frameNodes()

    const group = mockGroups.instances[0]
    expect(group.resizeTo).toHaveBeenCalledWith(
      mockApp.canvas.selectedItems,
      24
    )
    expect(mockApp.canvas.graph.add).toHaveBeenCalledWith(group)
    expect(mockTitleEditorStore.titleEditorTarget).toBe(group)
  })
})
