import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'
import type { useExtensionService } from '@/services/extensionService'

const { state } = vi.hoisted(() => ({
  state: {
    extension: null as { nodeCreated: (node: unknown) => void } | null
  }
}))

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: (ext: ComfyExtension) => {
        state.extension = fromPartial({ nodeCreated: ext.nodeCreated })
      }
    })
}))

await import('./createBoundingBoxes')

interface MockWidget {
  name: string
  hidden: boolean
  options: Record<string, unknown>
  widgetId?: string
}

function makeNode(comfyClass = 'CreateBoundingBoxes') {
  const widgets: MockWidget[] = [
    { name: 'width', hidden: false, options: {} },
    { name: 'last_incoming', hidden: false, options: {} }
  ]
  return {
    constructor: { comfyClass },
    size: [100, 100] as [number, number],
    setSize: vi.fn(),
    widgets
  }
}

describe('Comfy.CreateBoundingBoxes extension', () => {
  it('ignores nodes of other classes', () => {
    const node = makeNode('SomethingElse')
    state.extension!.nodeCreated(node)
    expect(node.setSize).not.toHaveBeenCalled()
    expect(node.widgets[1].hidden).toBe(false)
  })

  it('enlarges the node and hides only the internal last_incoming widget', () => {
    const node = makeNode()
    state.extension!.nodeCreated(node)
    expect(node.setSize).toHaveBeenCalledWith([420, 560])
    expect(node.widgets[0].hidden).toBe(false)
    expect(node.widgets[1].hidden).toBe(true)
  })
})
