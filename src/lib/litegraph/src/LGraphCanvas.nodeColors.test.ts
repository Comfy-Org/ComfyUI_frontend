import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({
  st: (_key: string, fallback: string) => fallback
}))

import type { ContextMenu } from './ContextMenu'
import { LGraphCanvas } from './LGraphCanvas'
import { LGraphGroup } from './LGraphGroup'
import { LGraphNode } from './LGraphNode'
import { LiteGraph } from './litegraph'

describe('LGraphCanvas.onMenuNodeColors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not add a custom color entry to the legacy submenu', () => {
    const node = Object.assign(Object.create(LGraphNode.prototype), {
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
    LiteGraph.ContextMenu =
      MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        node
      )

      const contents = capturedValues
        ?.filter(
          (value): value is { content?: string } =>
            typeof value === 'object' && value !== null
        )
        .map((value) => value.content ?? '')

      expect(contents).not.toEqual(
        expect.arrayContaining([expect.stringContaining('Custom...')])
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
    LiteGraph.ContextMenu =
      MockContextMenu as unknown as typeof LiteGraph.ContextMenu

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

  it('sanitizes legacy menu markup for extension-provided labels and colors', () => {
    const node = Object.assign(Object.create(LGraphNode.prototype), {
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
    const originalNodeColors = LGraphCanvas.node_colors
    class MockContextMenu {
      constructor(values: ReadonlyArray<{ content?: string } | string | null>) {
        capturedValues = values
      }
    }
    LiteGraph.ContextMenu =
      MockContextMenu as unknown as typeof LiteGraph.ContextMenu
    LGraphCanvas.node_colors = {
      ...originalNodeColors,
      '<img src=x onerror=1>': {
        color: '#000',
        bgcolor: 'not-a-color',
        groupcolor: '#fff'
      }
    }

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        node
      )

      const escapedEntry = capturedValues
        ?.filter(
          (value): value is { content?: string } =>
            typeof value === 'object' && value !== null
        )
        .map((value) => value.content ?? '')
        .find((content) => content.includes('&lt;img src=x onerror=1&gt;'))

      expect(escapedEntry).toBeDefined()
      expect(escapedEntry).not.toContain('<img src=x onerror=1>')
      expect(escapedEntry).not.toContain('background-color:not-a-color')
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
      LGraphCanvas.node_colors = originalNodeColors
    }
  })

  it('applies preset colors to selected nodes and groups in legacy mode', () => {
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

    let callback: ((value: { value?: unknown }) => void) | undefined
    const originalContextMenu = LiteGraph.ContextMenu
    class MockContextMenu {
      constructor(
        _values: ReadonlyArray<{ content?: string } | string | null>,
        options: { callback?: (value: { value?: unknown }) => void }
      ) {
        callback = options.callback
      }
    }
    LiteGraph.ContextMenu =
      MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        node
      )

      callback?.({
        value: 'red'
      })

      expect(node.bgcolor).toBe(LGraphCanvas.node_colors.red.bgcolor)
      expect(group.color).toBe(LGraphCanvas.node_colors.red.groupcolor)
      expect(graph.beforeChange).toHaveBeenCalled()
      expect(graph.afterChange).toHaveBeenCalled()
      expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
    }
  })

  it('does not fan out legacy preset actions to an unrelated single selection', () => {
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

    let callback: ((value: { value?: unknown }) => void) | undefined
    const originalContextMenu = LiteGraph.ContextMenu
    class MockContextMenu {
      constructor(
        _values: ReadonlyArray<{ content?: string } | string | null>,
        options: { callback?: (value: { value?: unknown }) => void }
      ) {
        callback = options.callback
      }
    }
    LiteGraph.ContextMenu =
      MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        targetNode
      )

      callback?.({
        value: 'red'
      })

      expect(targetNode.bgcolor).toBe(LGraphCanvas.node_colors.red.bgcolor)
      expect(selectedNode.bgcolor).toBeUndefined()
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
    }
  })

  it('keeps legacy group color actions scoped to the clicked group', () => {
    const graph = {
      beforeChange: vi.fn(),
      afterChange: vi.fn()
    }

    const selectedNode = Object.assign(Object.create(LGraphNode.prototype), {
      graph,
      color: undefined,
      bgcolor: undefined
    }) as LGraphNode
    const targetGroup = Object.assign(Object.create(LGraphGroup.prototype), {
      graph,
      color: undefined
    }) as LGraphGroup

    const canvas = {
      selectedItems: new Set([selectedNode, targetGroup]),
      setDirty: vi.fn()
    }
    LGraphCanvas.active_canvas = canvas as unknown as LGraphCanvas

    let callback: ((value: { value?: unknown }) => void) | undefined
    const originalContextMenu = LiteGraph.ContextMenu
    class MockContextMenu {
      constructor(
        _values: ReadonlyArray<{ content?: string } | string | null>,
        options: { callback?: (value: { value?: unknown }) => void }
      ) {
        callback = options.callback
      }
    }
    LiteGraph.ContextMenu =
      MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        targetGroup
      )

      callback?.({
        value: 'red'
      })

      expect(targetGroup.color).toBe(LGraphCanvas.node_colors.red.groupcolor)
      expect(selectedNode.bgcolor).toBeUndefined()
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
    }
  })

  it('balances graph change lifecycle if applying a legacy preset throws', () => {
    const graph = {
      beforeChange: vi.fn(),
      afterChange: vi.fn()
    }

    const node = Object.assign(Object.create(LGraphNode.prototype), {
      graph,
      setColorOption: vi.fn(() => {
        throw new Error('boom')
      })
    }) as LGraphNode

    const canvas = {
      selectedItems: new Set([node]),
      setDirty: vi.fn()
    }
    LGraphCanvas.active_canvas = canvas as unknown as LGraphCanvas

    let callback:
      | ((value: string | { value?: unknown } | null) => void)
      | undefined
    const originalContextMenu = LiteGraph.ContextMenu
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    class MockContextMenu {
      constructor(
        _values: ReadonlyArray<{ content?: string } | string | null>,
        options: {
          callback?: (value: string | { value?: unknown } | null) => void
        }
      ) {
        callback = options.callback
      }
    }
    LiteGraph.ContextMenu =
      MockContextMenu as unknown as typeof LiteGraph.ContextMenu

    try {
      LGraphCanvas.onMenuNodeColors(
        { content: 'Colors', value: null },
        {} as never,
        new MouseEvent('contextmenu'),
        {} as ContextMenu<string | null>,
        node
      )

      expect(() => callback?.('red')).not.toThrow()
      expect(graph.beforeChange).toHaveBeenCalledOnce()
      expect(graph.afterChange).toHaveBeenCalledOnce()
      expect(consoleErrorSpy).toHaveBeenCalled()
    } finally {
      LiteGraph.ContextMenu = originalContextMenu
      consoleErrorSpy.mockRestore()
    }
  })
})
