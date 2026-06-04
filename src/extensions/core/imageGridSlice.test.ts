import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyExtension } from '@/types/comfy'

const { capturedExtensions } = vi.hoisted(() => ({
  capturedExtensions: [] as ComfyExtension[]
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (ext: ComfyExtension) => {
      capturedExtensions.push(ext)
    }
  })
}))

interface MockWidget {
  name: string
  type?: string
  value?: unknown
  serialize?: boolean
}

function makeNode() {
  const widgets: MockWidget[] = [
    { name: 'rows', value: 2 },
    { name: 'columns', value: 2 }
  ]

  return {
    constructor: { comfyClass: 'ImageGridSlice' },
    size: [200, 200] as [number, number],
    widgets,
    addCustomWidget(widget: MockWidget) {
      widgets.push(widget)
      return widget
    },
    setSize: vi.fn()
  }
}

const extension = () =>
  capturedExtensions.find((e) => e.name === 'Comfy.ImageGridSlice')!

describe('Comfy.ImageGridSlice extension', () => {
  beforeAll(async () => {
    await import('./imageGridSlice')
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers under the expected name', () => {
    expect(extension()).toBeDefined()
  })

  it('ignores nodes of other types', () => {
    const node = makeNode()
    node.constructor.comfyClass = 'SomethingElse'
    extension().nodeCreated?.(node as never, undefined as never)
    expect(node.widgets).toHaveLength(2)
  })

  it('injects a non-serialized preview widget at the top of the node', () => {
    const node = makeNode()
    extension().nodeCreated?.(node as never, undefined as never)

    const preview = node.widgets[0]
    expect(preview.name).toBe('grid_preview')
    expect(preview.type).toBe('imagegridslice')
    expect(preview.serialize).toBe(false)
    expect(node.widgets.map((w) => w.name)).toEqual([
      'grid_preview',
      'rows',
      'columns'
    ])
  })

  it('does not add a second preview widget on repeat creation', () => {
    const node = makeNode()
    extension().nodeCreated?.(node as never, undefined as never)
    extension().nodeCreated?.(node as never, undefined as never)

    expect(node.widgets.filter((w) => w.name === 'grid_preview')).toHaveLength(
      1
    )
  })
})
