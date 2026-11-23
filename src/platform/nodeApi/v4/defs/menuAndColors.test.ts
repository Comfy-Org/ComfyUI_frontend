import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type {
  DefRegistry,
  NodeDefBuilder,
  NodeHandle,
  NodeMenuItem,
  PackToken
} from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

const TYPE = 'Pack/Probe'

describe('node menus and colors', () => {
  let graph: LGraph
  let defs: DefRegistry
  let host: ComfyApiHost

  let pack: PackToken

  beforeEach(() => {
    graph = new LGraph()
    const api = createComfyApi({ getGraph: () => graph })
    pack = registerTestPack(api)
    defs = api.comfy.defs
    host = api.host
    registerHostType(host.nodeTypeHooks, hostNodeDef(TYPE))
  })

  function extend(apply: (builder: NodeDefBuilder) => void) {
    return defs.extend(pack, TYPE, apply)
  }

  function withItems(...items: NodeMenuItem[]) {
    return extend((builder) => {
      for (const item of items) builder.addMenuItem(item)
    })
  }

  function withUntypedItems(...items: object[]) {
    return extend((builder) => {
      for (const item of items) {
        Reflect.apply(builder.addMenuItem, builder, [item])
      }
    })
  }

  function added(): LGraphNode {
    const node = LiteGraph.createNode(TYPE)
    assert(node)
    graph.add(node)
    return node
  }

  function menuOf(node: LGraphNode): IContextMenuValue[] {
    return host.nodeTypeHooks.getNodeMenuItems(node)
  }

  function click(entry: IContextMenuValue | undefined) {
    assert(entry?.callback)
    void Reflect.apply(entry.callback, null, [])
  }

  describe('addMenuItem', () => {
    it('adds an entry that runs with the node', () => {
      const run = vi.fn()
      withItems({ label: 'Reset', run })
      const node = added()

      const [entry] = menuOf(node)
      click(entry)

      expect(entry.content).toBe('Reset')
      expect(run).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ id: String(node.id) })
      )
    })

    it('labels an entry from the node, and shows it only when asked to', () => {
      const shown: NodeHandle[] = []
      withUntypedItems(
        {
          label: (node: NodeHandle) => `Reset ${node.getTitle()}`,
          when: (node: NodeHandle) => {
            shown.push(node)
            return node.getTitle() === 'Shown'
          },
          run: () => {}
        },
        {
          label: 'Truthy is not true',
          when: () => 'yes',
          run: () => {}
        }
      )
      const node = added()

      expect(menuOf(node)).toEqual([])

      node.title = 'Shown'

      expect(menuOf(node).map((entry) => entry.content)).toEqual([
        'Reset Shown'
      ])
      expect(shown).toHaveLength(2)
    })

    it('opens a submenu whose entries run with the node', () => {
      const run = vi.fn()
      withItems({ label: 'Pick', items: [{ label: 'First', run }] })
      const node = added()

      const [entry] = menuOf(node)
      const options = entry.submenu?.options ?? []
      const [child] = options.filter(
        (option): option is IContextMenuValue =>
          typeof option === 'object' && option !== null
      )
      click(child)

      expect(entry).toMatchObject({ content: 'Pick', has_submenu: true })
      expect(child.content).toBe('First')
      expect(run).toHaveBeenCalledOnce()
    })

    it('builds a submenu from the node, and leaves out an empty one', () => {
      const run = vi.fn()
      withItems(
        { label: 'Empty', items: () => [] },
        { label: 'Empty with run', items: () => [], run },
        { label: 'Filled', items: (node) => [{ label: node.type ?? '', run }] }
      )

      const entries = menuOf(added())

      expect(entries.map((entry) => entry.content)).toEqual([
        'Empty with run',
        'Filled'
      ])
      expect(entries[1].submenu?.options).toEqual([
        expect.objectContaining({ content: TYPE })
      ])
    })

    it('orders entries by order, then by when they were added', () => {
      withItems(
        { label: 'late', order: 2, run: () => {} },
        { label: 'none', run: () => {} },
        { label: 'early', order: -1, run: () => {} },
        { label: 'also none', order: 0, run: () => {} }
      )

      expect(menuOf(added()).map((entry) => entry.content)).toEqual([
        'early',
        'none',
        'also none',
        'late'
      ])
    })

    it('gives no entries for a node outside a graph', () => {
      withItems({ label: 'Reset', run: () => {} })
      const node = LiteGraph.createNode(TYPE)
      assert(node)

      expect(menuOf(node)).toEqual([])

      graph.add(node)

      expect(menuOf(node)).toHaveLength(1)
    })

    it('reports an entry whose label, test or submenu fails, and shows the others', () => {
      const broken = new Error('label failed')
      withUntypedItems(
        {
          label: () => {
            throw broken
          },
          run: () => {}
        },
        { label: () => 5, run: () => {} },
        { label: 'Bad items', items: () => 'x' },
        { label: 'Kept', run: () => {} }
      )

      expect(menuOf(added()).map((entry) => entry.content)).toEqual(['Kept'])
      expect(reportError).toHaveBeenCalledWith(
        broken,
        expect.objectContaining({ tags: { event: 'addMenuItem' } })
      )
      expect(reportError).toHaveBeenCalledTimes(3)
    })

    it('reports an entry whose test rejects, once, and does not show it', async () => {
      const broken = new Error('when rejected')
      withUntypedItems({
        label: 'Async',
        when: () => Promise.reject(broken),
        run: () => {}
      })
      const node = added()

      expect(menuOf(node)).toEqual([])
      expect(menuOf(node)).toEqual([])
      await Promise.resolve()

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        broken,
        expect.objectContaining({ tags: { event: 'addMenuItem' } })
      )
    })

    it('reports an entry that throws when run', () => {
      const broken = new Error('run failed')
      withItems({
        label: 'Run',
        run: () => {
          throw broken
        }
      })

      click(menuOf(added())[0])

      expect(reportError).toHaveBeenCalledWith(
        broken,
        expect.objectContaining({ tags: { event: 'addMenuItem' } })
      )
    })

    it('does not run an entry for a node removed since the menu opened', () => {
      const run = vi.fn()
      withItems({ label: 'Run', run })
      const node = added()
      const [entry] = menuOf(node)

      graph.remove(node)
      click(entry)

      expect(run).not.toHaveBeenCalled()
    })

    it('keeps the submenu it was given, whatever the pack changes later', () => {
      const items = [{ label: 'First', run: () => {} }]
      withItems({ label: 'Pick', items })

      items.push({ label: 'Second', run: () => {} })

      expect(menuOf(added())[0].submenu?.options).toHaveLength(1)
    })

    it('removes its entries when the extension is unsubscribed', () => {
      const stop = withItems({ label: 'Gone', run: () => {} })
      withItems({ label: 'Kept', run: () => {} })

      stop()

      expect(menuOf(added()).map((entry) => entry.content)).toEqual(['Kept'])
    })

    it.for([
      { name: 'a value that is not an object', item: 'Reset' },
      { name: 'an unknown field', item: { label: 'x', run() {}, icon: 'i' } },
      { name: 'a label that is a number', item: { label: 5, run() {} } },
      {
        name: 'a test that is not a function',
        item: { label: 'x', when: true, run() {} }
      },
      { name: 'a run that is not a function', item: { label: 'x', run: 'go' } },
      { name: 'neither run nor items', item: { label: 'x' } },
      {
        name: 'an order that is not finite',
        item: { label: 'x', order: Number.NaN, run() {} }
      },
      {
        name: 'an order that is text',
        item: { label: 'x', order: '1', run() {} }
      },
      { name: 'items that are not a list', item: { label: 'x', items: {} } },
      {
        name: 'a submenu entry without run',
        item: { label: 'x', items: [{ label: 'y' }] }
      },
      {
        name: 'a submenu entry with more fields',
        item: { label: 'x', items: [{ label: 'y', run() {}, order: 1 }] }
      },
      {
        name: 'a submenu entry that is not an object',
        item: { label: 'x', items: ['y'] }
      }
    ])('refuses $name and adds nothing', ({ item }) => {
      let refusal: unknown
      extend((builder) => {
        try {
          Reflect.apply(builder.addMenuItem, builder, [item])
        } catch (error) {
          refusal = error
        }
        builder.addMenuItem({ label: 'Control', run: () => {} })
      })

      expect(refusal).toBeInstanceOf(TypeError)
      expect(menuOf(added()).map((entry) => entry.content)).toEqual(['Control'])
    })
  })

  describe('type colors', () => {
    beforeEach(() => {
      const before = { ...LGraphCanvas.link_type_colors }
      return () => {
        for (const key of Object.keys(LGraphCanvas.link_type_colors)) {
          if (!Object.hasOwn(before, key))
            delete LGraphCanvas.link_type_colors[key]
        }
        Object.assign(LGraphCanvas.link_type_colors, before)
      }
    })

    it.for([5, '', null])('refuses %j as a type to read', (type) => {
      expectRefusal(
        () => Reflect.apply(defs.typeColor, defs, [type]),
        'typeColor'
      )
    })

    it('reads the color of a type, and nothing for a type nothing colors', () => {
      LGraphCanvas.link_type_colors.COLORED = '#123'
      LGraphCanvas.link_type_colors.CLEARED = ''

      expect(defs.typeColor('COLORED')).toBe('#123')
      expect(defs.typeColor('CLEARED')).toBeUndefined()
      expect(defs.typeColor('UNKNOWN')).toBeUndefined()
      expect(defs.typeColor('__proto__')).toBeUndefined()
    })

    it('colors a type the palette leaves uncolored, and gives it back when unsubscribed', () => {
      LGraphCanvas.link_type_colors.CLEARED = ''

      const stopNew = defs.setTypeColor('PACK_TYPE', '#a00')
      const stopCleared = defs.setTypeColor('CLEARED', '#0a0')

      expect(defs.typeColor('PACK_TYPE')).toBe('#a00')
      expect(defs.typeColor('CLEARED')).toBe('#0a0')

      stopNew()
      stopNew()
      stopCleared()

      expect(Object.hasOwn(LGraphCanvas.link_type_colors, 'PACK_TYPE')).toBe(
        false
      )
      expect(LGraphCanvas.link_type_colors.CLEARED).toBe('')
    })

    it.for(['__proto__', 'constructor', 'toString'])(
      'refuses %s as a type to color, and leaves the table as it was',
      (type) => {
        const prototype = Object.getPrototypeOf(LGraphCanvas.link_type_colors)

        expectRefusal(() => defs.setTypeColor(type, '#123456'), 'setTypeColor')
        expect(Object.hasOwn(LGraphCanvas.link_type_colors, type)).toBe(false)
        expect(Object.getPrototypeOf(LGraphCanvas.link_type_colors)).toBe(
          prototype
        )
      }
    )

    it('refuses a type the palette colors, and leaves its color', () => {
      LGraphCanvas.link_type_colors.IMAGE = '#64B5F6'

      expectRefusal(() => defs.setTypeColor('IMAGE', '#000'), 'setTypeColor')
      expect(defs.typeColor('IMAGE')).toBe('#64B5F6')
    })

    it('lets a type a pack colored be colored again, the newest winning', () => {
      const stopFirst = defs.setTypeColor('PACK_TYPE', '#a00')
      const stopSecond = defs.setTypeColor('PACK_TYPE', '#0a0')

      expect(defs.typeColor('PACK_TYPE')).toBe('#0a0')

      stopSecond()

      expect(defs.typeColor('PACK_TYPE')).toBe('#a00')

      stopFirst()

      expect(defs.typeColor('PACK_TYPE')).toBeUndefined()
    })

    it('keeps the newest color when an older one is unsubscribed', () => {
      const stopFirst = defs.setTypeColor('PACK_TYPE', '#a00')
      defs.setTypeColor('PACK_TYPE', '#0a0')

      stopFirst()

      expect(defs.typeColor('PACK_TYPE')).toBe('#0a0')
    })

    it('puts a pack color back after a palette clears it, and leaves a palette color', () => {
      defs.setTypeColor('CLEARED_BY_PALETTE', '#a00')
      defs.setTypeColor('COLORED_BY_PALETTE', '#0a0')
      LGraphCanvas.link_type_colors.CLEARED_BY_PALETTE = ''
      LGraphCanvas.link_type_colors.COLORED_BY_PALETTE = '#00f'

      host.reapplyTypeColors()

      expect(defs.typeColor('CLEARED_BY_PALETTE')).toBe('#a00')
      expect(defs.typeColor('COLORED_BY_PALETTE')).toBe('#00f')
    })

    it('leaves a palette color alone when the pack color it replaced is unsubscribed', () => {
      const stop = defs.setTypeColor('PACK_TYPE', '#a00')
      LGraphCanvas.link_type_colors.PACK_TYPE = '#00f'

      stop()

      expect(defs.typeColor('PACK_TYPE')).toBe('#00f')
      expectRefusal(
        () => defs.setTypeColor('PACK_TYPE', '#a00'),
        'setTypeColor'
      )
    })

    it.for([
      ['', '#a00'],
      [5, '#a00'],
      ['PACK_TYPE', ''],
      ['PACK_TYPE', null]
    ])('refuses a type or color of %j and %j', ([type, color]) => {
      expectRefusal(
        () => Reflect.apply(defs.setTypeColor, defs, [type, color]),
        'setTypeColor'
      )
      expect(Object.hasOwn(LGraphCanvas.link_type_colors, 'PACK_TYPE')).toBe(
        false
      )
    })
  })

  describe('node colors', () => {
    it('gives the colors of a named entry, frozen', () => {
      const red = defs.nodeColor('red')

      expect(red).toEqual({
        color: LGraphCanvas.node_colors.red.color,
        bgColor: LGraphCanvas.node_colors.red.bgcolor,
        groupColor: LGraphCanvas.node_colors.red.groupcolor
      })
      expect(Object.isFrozen(red)).toBe(true)
    })

    it.for(['ultraviolet', 'constructor', '__proto__'])(
      'gives nothing for %s',
      (name) => {
        expect(defs.nodeColor(name)).toBeUndefined()
      }
    )

    it.for([5, '', undefined])('refuses %j as a name', (name) => {
      expectRefusal(
        () => Reflect.apply(defs.nodeColor, defs, [name]),
        'nodeColor'
      )
    })
  })

  describe('type compatibility', () => {
    it.for([
      { output: 'IMAGE', input: 'IMAGE', compatible: true },
      { output: 'IMAGE', input: '*', compatible: true },
      { output: 'IMAGE', input: 'IMAGE,MASK', compatible: true },
      { output: 'IMAGE', input: 'LATENT', compatible: false }
    ])(
      'answers $compatible for $output into $input',
      ({ output, input, compatible }) => {
        expect(defs.isTypeCompatible(output, input)).toBe(compatible)
      }
    )

    it.for([
      [5, 'IMAGE'],
      ['IMAGE', undefined]
    ])('refuses %j and %j', ([output, input]) => {
      expectRefusal(
        () => Reflect.apply(defs.isTypeCompatible, defs, [output, input]),
        'isTypeCompatible'
      )
    })
  })
})
