import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    extension: null as { nodeCreated: (node: unknown) => void } | null,
    widgetState: undefined as { options: Record<string, unknown> } | undefined
  }
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: { nodeCreated: (node: unknown) => void }) => {
      state.extension = ext
    }
  })
}))

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({ getWidget: () => state.widgetState })
}))

await import('./createBoundingBoxes')

interface MockWidget {
  name: string
  hidden: boolean
  options: Record<string, unknown>
  widgetId?: string
}

function makeNode(connected: boolean, comfyClass = 'CreateBoundingBoxes') {
  const widgets: MockWidget[] = [
    { name: 'width', hidden: false, options: {} },
    { name: 'height', hidden: false, options: {} },
    { name: 'other', hidden: false, options: {} },
    { name: 'last_incoming', hidden: false, options: {} }
  ]
  return {
    constructor: { comfyClass },
    size: [100, 100] as [number, number],
    setSize: vi.fn(),
    findInputSlot: () => 0,
    isInputConnected: () => connected,
    widgets,
    onConnectionsChange: undefined as unknown
  }
}

beforeEach(() => {
  state.widgetState = undefined
})

describe('Comfy.CreateBoundingBoxes extension', () => {
  it('ignores nodes of other classes', () => {
    const node = makeNode(true, 'SomethingElse')
    state.extension!.nodeCreated(node)
    expect(node.setSize).not.toHaveBeenCalled()
  })

  it('enlarges the node and hides width/height when a background is connected', () => {
    const node = makeNode(true)
    state.extension!.nodeCreated(node)
    expect(node.setSize).toHaveBeenCalledWith([420, 560])
    expect(node.widgets[0].hidden).toBe(true)
    expect(node.widgets[1].hidden).toBe(true)
    expect(node.widgets[0].options.hidden).toBe(true)
    expect(node.widgets[2].hidden).toBe(false)
  })

  it('shows width/height when no background is connected', () => {
    const node = makeNode(false)
    state.extension!.nodeCreated(node)
    expect(node.widgets[0].hidden).toBe(false)
    expect(node.widgets[0].options.hidden).toBe(false)
  })

  it('always hides the internal last_incoming widget', () => {
    for (const connected of [true, false]) {
      const node = makeNode(connected)
      state.extension!.nodeCreated(node)
      expect(node.widgets[3].hidden).toBe(true)
      expect(node.widgets[3].options.hidden).toBe(true)
    }
  })

  it('writes visibility through the widget value store when present', () => {
    state.widgetState = { options: {} }
    const node = makeNode(true)
    node.widgets[0].widgetId = 'w-0'
    state.extension!.nodeCreated(node)
    expect(state.widgetState.options.hidden).toBe(true)
  })

  it('chains a connections-change handler that re-syncs visibility', () => {
    const node = makeNode(false)
    state.extension!.nodeCreated(node)
    expect(typeof node.onConnectionsChange).toBe('function')
  })
})
