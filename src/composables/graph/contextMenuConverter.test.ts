import { describe, it, expect, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@comfyorg/litegraph/litegraph'
import { markNodeMenuCallback } from '@comfyorg/litegraph/types/nodeMenu'
import en from '@/locales/en/main.json'
import fr from '@/locales/fr/main.json'
import { createTestCanvasElement } from '@comfyorg/litegraph/__fixtures__/canvasTestUtils'

import type { MenuOption } from './menuOption'
import {
  buildStructuredMenu,
  convertContextMenuToOptions
} from './contextMenuConverter'

describe('node menu assembly', () => {
  it.for(['en', 'fr'])(
    'keeps media first, core sections ordered, extensions intact and Delete last in %s',
    (locale) => {
      const { t } = createI18n({
        legacy: false,
        locale,
        messages: { en, fr }
      }).global
      const options: MenuOption[] = [
        { id: 'delete', label: t('contextMenu.Delete') },
        { label: t('contextMenu.Copy'), action: vi.fn() },
        { id: 'color', label: t('contextMenu.Color') },
        { id: 'pin', label: t('contextMenu.Unpin') },
        { id: 'copy', label: t('contextMenu.Copy') },
        { id: 'downloadImages', label: t('contextMenu.Download Images') },
        {
          id: 'previewResolution',
          label: t('contextMenu.Show Full Resolution')
        },
        { id: 'rename', label: t('contextMenu.Rename') },
        { id: 'openImage', label: t('contextMenu.Open Image') }
      ]

      const result = buildStructuredMenu(options, t('contextMenu.Extensions'))

      expect(
        result.map((option) => option.id ?? option.type ?? option.label)
      ).toEqual([
        'openImage',
        'previewResolution',
        'downloadImages',
        'divider',
        'rename',
        'copy',
        'divider',
        'pin',
        'divider',
        'color',
        'divider',
        'category',
        t('contextMenu.Copy'),
        'divider',
        'delete'
      ])
      expect(result.at(-1)?.label).toBe(t('contextMenu.Delete'))
      expect(result.find((option) => option.id === 'openImage')?.label).toBe(
        t('contextMenu.Open Image')
      )
    }
  )

  it('prefers the Vue replacement only for the same core identity', () => {
    const nativeAction = vi.fn()
    const vueAction = vi.fn()
    const extensionAction = vi.fn()
    const native = {
      id: 'pin',
      label: 'Pin',
      action: nativeAction
    } satisfies MenuOption
    const vue = {
      id: 'pin',
      label: 'Désépingler',
      action: vueAction
    } satisfies MenuOption
    const extension = { label: 'Désépingler', action: extensionAction }

    const result = buildStructuredMenu([native, extension, vue], 'Extensions')

    expect(result.filter((option) => option.action)).toEqual([vue, extension])
    result[0].action?.()
    result[3].action?.()
    expect(vueAction).toHaveBeenCalledOnce()
    expect(extensionAction).toHaveBeenCalledOnce()
    expect(nativeAction).not.toHaveBeenCalled()
  })

  it('preserves same-label extensions, including labels formerly blacklisted or treated as Delete', () => {
    const extensions = ['Copy', 'Copy', 'Properties', 'Remove', 'Bypass'].map(
      (content) => ({ content })
    )

    const result = buildStructuredMenu(
      [
        ...convertContextMenuToOptions(extensions),
        { id: 'copy', label: 'Copy' },
        { id: 'delete', label: 'Delete' }
      ],
      'Extensions'
    )

    expect(result.map((option) => option.label ?? option.type)).toEqual([
      'Copy',
      'divider',
      'Extensions',
      'Copy',
      'Copy',
      'Properties',
      'Remove',
      'Bypass',
      'divider',
      'Delete'
    ])
  })

  it.for([
    { name: 'empty', options: [], expected: [] },
    { name: 'separators only', options: [{ type: 'divider' }], expected: [] },
    {
      name: 'Delete only',
      options: [{ id: 'delete', label: 'Delete' }],
      expected: ['Delete']
    },
    {
      name: 'extensions only',
      options: [{ label: 'Custom' }],
      expected: ['Extensions', 'Custom']
    }
  ] satisfies { name: string; options: MenuOption[]; expected: string[] }[])(
    'avoids empty sections and stray dividers for $name',
    ({ options, expected }) => {
      expect(
        buildStructuredMenu(options, 'Extensions').map(
          (option) => option.label ?? option.type
        )
      ).toEqual(expected)
    }
  )

  it('keeps legacy-only core actions and scoped widget actions outside Extensions', () => {
    const firstWidget = {
      id: 'widget:graph:1:seed:favorite',
      label: 'Favorite seed'
    } satisfies MenuOption
    const secondWidget = {
      id: 'widget:graph:1:steps:favorite',
      label: 'Favorite steps'
    } satisfies MenuOption
    const result = buildStructuredMenu(
      [
        firstWidget,
        secondWidget,
        firstWidget,
        { id: 'pasteClipspace', label: 'Paste (Clipspace)' },
        { id: 'advanced', label: 'Show Advanced' },
        { id: 'editSubgraphWidgets', label: 'Edit Subgraph Widgets' }
      ],
      'Extensions'
    )

    expect(result.map((option) => option.label ?? option.type)).toEqual([
      'Show Advanced',
      'divider',
      'Edit Subgraph Widgets',
      'Paste (Clipspace)',
      'divider',
      'Favorite seed',
      'Favorite steps'
    ])
  })
})

describe('LiteGraph menu conversion', () => {
  it.for([false, true])(
    'retains native subgraph conversion while suppressing replaced actions after relabeling, multiple selection: %s',
    (multiple) => {
      const graph = new LGraph()
      const canvas = new LGraphCanvas(createTestCanvasElement(), graph, {
        skip_render: true,
        skip_events: true
      })
      const node = new LGraphNode('Core node')
      graph.add(node)
      const nodes = multiple ? [node, new LGraphNode('Second node')] : [node]
      if (multiple) graph.add(nodes[1])
      canvas.selectItems(nodes)

      const items = canvas.getNodeMenuOptions(node).map((item) => {
        if (item) item.content = 'Localized core action'
        return item
      })
      const result = convertContextMenuToOptions(items, node)

      expect(
        result
          .filter((option) => option.type !== 'divider')
          .map((option) => option.id)
      ).toEqual(['convertSubgraph'])
    }
  )

  it('recognizes registered closure identities without touching same-label extensions', () => {
    const extensionAction = vi.fn()
    const options = convertContextMenuToOptions([
      { content: 'Bypass', callback: markNodeMenuCallback(vi.fn(), null) },
      { content: 'Bypass', callback: extensionAction },
      {
        content: 'Coller',
        callback: markNodeMenuCallback(vi.fn(), 'pasteClipspace')
      }
    ])

    expect(options.map((option) => [option.id, option.label])).toEqual([
      [undefined, 'Bypass'],
      ['pasteClipspace', 'Coller']
    ])
    options[0].action?.()
    expect(extensionAction).toHaveBeenCalledOnce()
  })

  it('forwards node context, disabled state and separators', () => {
    const node = new LGraphNode('Custom Action')
    const callback = vi.fn()
    const disabledCallback = vi.fn()
    const options = convertContextMenuToOptions(
      [
        { content: 'Custom Action', callback },
        null,
        {
          content: 'Disabled Action',
          disabled: true,
          callback: disabledCallback
        }
      ],
      node
    )

    options[0].action?.()
    options[2].action?.()

    expect(callback.mock.calls[0]?.[4]).toBe(node)
    expect(options[1]).toEqual({ type: 'divider' })
    expect(options[2].disabled).toBe(true)
    expect(disabledCallback).not.toHaveBeenCalled()
  })

  it('adapts static submenus and sanitizes their labels', () => {
    const callback = vi.fn()
    const options = convertContextMenuToOptions([
      {
        content: 'Custom submenu',
        has_submenu: true,
        submenu: {
          options: [
            { content: '<b>Run</b>', callback },
            { content: 'Unavailable', disabled: true }
          ]
        }
      }
    ])

    expect(options[0].submenu?.map((option) => option.label)).toEqual([
      'Run',
      'Unavailable'
    ])
    expect(options[0].submenu?.[1].disabled).toBe(true)
    options[0].submenu?.[0].action()
    expect(callback).toHaveBeenCalledOnce()
  })

  it('captures dynamic submenus and restores the native constructor', () => {
    const original = LiteGraph.ContextMenu
    const callback = vi.fn()
    const options = convertContextMenuToOptions([
      {
        content: 'Save',
        has_submenu: true,
        callback: () => {
          new LiteGraph.ContextMenu(['GLB', 'OBJ'], { callback })
        }
      }
    ])

    expect(LiteGraph.ContextMenu).toBe(original)
    expect(options[0].submenu?.map((option) => option.label)).toEqual([
      'GLB',
      'OBJ'
    ])
    options[0].submenu?.[1].action()
    expect(callback.mock.calls[0]?.[0]).toBe('OBJ')
  })
})
