import { beforeEach, describe, expect, it, vi } from 'vitest'

const settingStoreMock = vi.hoisted(() => ({
  get: vi.fn(() => true)
}))

vi.mock('@/i18n', () => ({
  st: (_key: string, fallback: string) => fallback
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => settingStoreMock
}))

vi.mock('@/utils/nodeColorPersistence', async () => {
  const actual = await vi.importActual<typeof import('@/utils/nodeColorPersistence')>(
    '@/utils/nodeColorPersistence'
  )

  return {
    ...actual,
    pickHexColor: vi.fn().mockResolvedValue('#abcdef')
  }
})

import type { ContextMenu } from './ContextMenu'
import { LGraphCanvas } from './LGraphCanvas'
import { LGraphGroup } from './LGraphGroup'
import { LGraphNode } from './LGraphNode'
import { LiteGraph } from './litegraph'

describe('LGraphCanvas.onMenuNodeColors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingStoreMock.get.mockReturnValue(true)
  })

  it('adds a custom color entry to the legacy submenu', () => {
    const graph = {
      beforeChange: vi.fn(),
      afterChange: vi.fn()
    }
    const node = Object.assign(Object.create(LGraphNode.prototype), {
      graph,
      color: undefined,
      bgcolor: undefined
    }) as LGraphNode

    const canvas = {
      selectedItems: new Set([node]),
      setDirty: vi.fn()
    }
    LGraphCanvas.active_canvas = canvas as unknown as LGraphCanvas

    let capturedValues:
      | ReadonlyArray<{ content?: string } | string | null>
      | undefined
    const originalContextMenu = LiteGraph.ContextMenu
    class MockContextMenu {
      constructor(values: ReadonlyArray<{ content?: string } | string | null>) {
        capturedValues = values
      }
    }
    LiteGraph.ContextMenu = MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        node
      )

      const contents = capturedValues
        ?.filter((value): value is { content?: string } => typeof value === 'object' && value !== null)
        .map((value) => value.content ?? '')

      expect(contents).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Custom...')
        ])
      )
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
    }
  })

  it('uses group preset colors for legacy group menu swatches', () => {
    const group = Object.assign(Object.create(LGraphGroup.prototype), {
      color: undefined
    }) as LGraphGroup

    const canvas = {
      selectedItems: new Set([group]),
      setDirty: vi.fn()
    }
    LGraphCanvas.active_canvas = canvas as unknown as LGraphCanvas

    let capturedValues:
      | ReadonlyArray<{ content?: string } | string | null>
      | undefined
    const originalContextMenu = LiteGraph.ContextMenu
    class MockContextMenu {
      constructor(values: ReadonlyArray<{ content?: string } | string | null>) {
        capturedValues = values
      }
    }
    LiteGraph.ContextMenu = MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        group
      )

      const contents = capturedValues
        ?.filter(
          (value): value is { content?: string } =>
            typeof value === 'object' && value !== null
        )
        .map((value) => value.content ?? '')

      expect(contents).toEqual(
        expect.arrayContaining([
          expect.stringContaining(LGraphCanvas.node_colors.red.groupcolor)
        ])
      )
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
    }
  })

  it('applies a picked custom color to selected nodes and groups in legacy mode', async () => {
    const graph = {
      beforeChange: vi.fn(),
      afterChange: vi.fn()
    }

    const node = Object.assign(Object.create(LGraphNode.prototype), {
      graph,
      color: undefined,
      bgcolor: undefined
    }) as LGraphNode
    const group = Object.assign(Object.create(LGraphGroup.prototype), {
      graph,
      color: undefined
    }) as LGraphGroup

    const canvas = {
      selectedItems: new Set([node, group]),
      setDirty: vi.fn()
    }
    LGraphCanvas.active_canvas = canvas as unknown as LGraphCanvas

    let callback:
      | ((value: { value?: unknown }) => void)
      | undefined
    const originalContextMenu = LiteGraph.ContextMenu
    class MockContextMenu {
      constructor(
        _values: ReadonlyArray<{ content?: string } | string | null>,
        options: { callback?: (value: { value?: unknown }) => void }
      ) {
        callback = options.callback
      }
    }
    LiteGraph.ContextMenu = MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        node
      )

      callback?.({
        value: {
          kind: 'custom-picker'
        }
      })
      await Promise.resolve()
      await Promise.resolve()

      expect(node.bgcolor).toBe('#abcdef')
      expect(node.color).not.toBe('#abcdef')
      expect(group.color).toBe('#abcdef')
      expect(graph.beforeChange).toHaveBeenCalled()
      expect(graph.afterChange).toHaveBeenCalled()
      expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
    }
  })

  it('respects the darker-header setting in legacy custom colors', async () => {
    settingStoreMock.get.mockReturnValue(false)

    const graph = {
      beforeChange: vi.fn(),
      afterChange: vi.fn()
    }

    const node = Object.assign(Object.create(LGraphNode.prototype), {
      graph,
      color: undefined,
      bgcolor: undefined
    }) as LGraphNode

    const canvas = {
      selectedItems: new Set([node]),
      setDirty: vi.fn()
    }
    LGraphCanvas.active_canvas = canvas as unknown as LGraphCanvas

    let callback:
      | ((value: { value?: unknown }) => void)
      | undefined
    const originalContextMenu = LiteGraph.ContextMenu
    class MockContextMenu {
      constructor(
        _values: ReadonlyArray<{ content?: string } | string | null>,
        options: { callback?: (value: { value?: unknown }) => void }
      ) {
        callback = options.callback
      }
    }
    LiteGraph.ContextMenu = MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        node
      )

      callback?.({
        value: {
          kind: 'custom-picker'
        }
      })
      await Promise.resolve()
      await Promise.resolve()

      expect(node.bgcolor).toBe('#abcdef')
      expect(node.color).toBe('#abcdef')
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
    }
  })

  it('does not fan out legacy color actions to an unrelated single selection', async () => {
    const graph = {
      beforeChange: vi.fn(),
      afterChange: vi.fn()
    }

    const selectedNode = Object.assign(Object.create(LGraphNode.prototype), {
      graph,
      color: undefined,
      bgcolor: undefined
    }) as LGraphNode
    const targetNode = Object.assign(Object.create(LGraphNode.prototype), {
      graph,
      color: undefined,
      bgcolor: undefined
    }) as LGraphNode

    const canvas = {
      selectedItems: new Set([selectedNode]),
      setDirty: vi.fn()
    }
    LGraphCanvas.active_canvas = canvas as unknown as LGraphCanvas

    let callback:
      | ((value: { value?: unknown }) => void)
      | undefined
    const originalContextMenu = LiteGraph.ContextMenu
    class MockContextMenu {
      constructor(
        _values: ReadonlyArray<{ content?: string } | string | null>,
        options: { callback?: (value: { value?: unknown }) => void }
      ) {
        callback = options.callback
      }
    }
    LiteGraph.ContextMenu = MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        targetNode
      )

      callback?.({
        value: {
          kind: 'custom-picker'
        }
      })
      await Promise.resolve()
      await Promise.resolve()

      expect(targetNode.bgcolor).toBe('#abcdef')
      expect(selectedNode.bgcolor).toBeUndefined()
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
    }
  })
})
