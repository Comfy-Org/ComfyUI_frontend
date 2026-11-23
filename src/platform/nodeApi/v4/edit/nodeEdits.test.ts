import { LGraphEventMode, RenderShape } from '@comfyorg/graph-model/globalEnums'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { EditCore } from '@/platform/nodeApi/v4/edit/edits'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { NodePatch } from '@/platform/nodeApi/v4/edit/nodePatch'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

function recordingHistory() {
  const steps: string[] = []
  return {
    steps,
    beforeChange: () => steps.push('before'),
    afterChange: () => steps.push('after')
  }
}

describe('node edits', () => {
  let graph: LGraph
  let comfy: Comfy
  let edit: EditCore
  let host: ComfyApiHost
  let history: ReturnType<typeof recordingHistory>

  beforeEach(() => {
    graph = new LGraph()
    history = recordingHistory()
    ;({ comfy, host, edit } = createComfyApi({
      getGraph: () => graph,
      history: () => history
    }))
  })

  function add(title = 'Node') {
    const node = new LGraphNode(title, 'TestNode')
    graph.add(node)
    const handle = comfy.graph.node(String(node.id))
    assert(handle)
    return { node, handle }
  }

  function stateOf(node: LGraphNode) {
    return {
      title: node.title,
      mode: node.mode,
      collapsed: node.collapsed,
      color: node.color,
      bgcolor: node.bgcolor,
      shape: node.shape,
      properties: { ...node.properties },
      serializeWidgets: node.serialize_widgets,
      pos: Array.from(node.pos),
      size: Array.from(node.size),
      resizable: node.resizable
    }
  }

  describe('updateNode', () => {
    it('applies every field of a patch to the node', () => {
      const { node, handle } = add()

      const applied = edit.updateNode(handle, {
        title: 'Renamed',
        mode: 'bypass',
        collapsed: true,
        color: '#123',
        bgColor: '#456',
        shape: 'box',
        properties: { amount: 3, nested: { list: [1, 2] } },
        serializeWidgets: true,
        position: { x: 40, y: 60 },
        size: { width: 300, height: 200 }
      })

      expect(applied).toBe(true)
      expect(stateOf(node)).toMatchObject({
        title: 'Renamed',
        mode: LGraphEventMode.BYPASS,
        collapsed: true,
        color: '#123',
        bgcolor: '#456',
        shape: RenderShape.BOX,
        properties: { amount: 3, nested: { list: [1, 2] } },
        serializeWidgets: true,
        pos: [40, 60],
        size: [300, 200]
      })
    })

    it('makes one undo step of a patch, and advances the graph version', () => {
      const { handle } = add()
      const version = graph._version

      edit.updateNode(handle, { title: 'A', color: '#111' })

      expect(history.steps).toEqual(['before', 'after'])
      expect(graph._version).toBeGreaterThan(version)
    })

    it('captures the change after it is applied', () => {
      const { node, handle } = add('Before')
      const seen: string[] = []
      history.afterChange = () => seen.push(node.title)

      edit.updateNode(handle, { title: 'After' })

      expect(seen).toEqual(['After'])
    })

    it('redraws the graph after an edit', () => {
      const { handle } = add()
      const redraw = vi.spyOn(graph, 'setDirtyCanvas')

      edit.updateNode(handle, { title: 'Shown' })

      expect(redraw).toHaveBeenCalledWith(true, true)
    })

    it('leaves fields the patch does not name as they are', () => {
      const { node, handle } = add('Kept')
      node.color = '#abc'

      edit.updateNode(handle, { bgColor: '#def' })

      expect([node.title, node.color, node.bgcolor]).toEqual([
        'Kept',
        '#abc',
        '#def'
      ])
    })

    it('restores the default colors and shape', () => {
      const { node, handle } = add()
      node.color = '#abc'
      node.bgcolor = '#def'
      node.shape = RenderShape.CARD

      edit.updateNode(handle, {
        color: undefined,
        bgColor: undefined,
        shape: 'default'
      })

      expect([node.color, node.bgcolor, node.shape]).toEqual([
        undefined,
        undefined,
        undefined
      ])
    })

    it('restores the default colors for null as for undefined', () => {
      const { node, handle } = add()
      node.color = '#abc'
      node.bgcolor = '#def'

      expect(handle.setColor(null)).toBe(true)
      expect(edit.updateNode(handle, { bgColor: null })).toBe(true)

      expect([node.color, node.bgcolor]).toEqual([undefined, undefined])
    })

    it('expands a collapsed node, and leaves it alone when it already is as asked', () => {
      const { node, handle } = add()
      const collapse = vi.spyOn(node, 'collapse')

      edit.updateNode(handle, { collapsed: false })
      expect(collapse).not.toHaveBeenCalled()

      edit.updateNode(handle, { collapsed: true })
      edit.updateNode(handle, { collapsed: false })

      expect(node.collapsed).toBe(false)
      expect(collapse).toHaveBeenCalledTimes(2)
    })

    it('collapses a pinned node when a pack asks', () => {
      const { node, handle } = add()
      node.pin(true)

      edit.updateNode(handle, { collapsed: true })

      expect(node.collapsed).toBe(true)
    })

    it.for([
      ['always', LGraphEventMode.ALWAYS],
      ['never', LGraphEventMode.NEVER],
      ['bypass', LGraphEventMode.BYPASS]
    ] as const)('sets mode %s', ([mode, value]) => {
      const { node, handle } = add()

      edit.updateNode(handle, { mode })

      expect(node.mode).toBe(value)
      expect(handle.getMode()).toBe(mode)
    })

    it.for([
      ['box', RenderShape.BOX],
      ['round', RenderShape.ROUND],
      ['circle', RenderShape.CIRCLE],
      ['card', RenderShape.CARD]
    ] as const)('sets shape %s', ([shape, value]) => {
      const { node, handle } = add()

      edit.updateNode(handle, { shape })

      expect(node.shape).toBe(value)
    })

    it('stores a copy of a property the workflow saves unchanged, through the node', () => {
      const { node, handle } = add()
      const onPropertyChanged = vi.fn()
      node.onPropertyChanged = onPropertyChanged
      const value = { when: '1970-01-01T00:00:00.000Z', list: [1, null] }

      edit.updateNode(handle, { properties: { stamp: value } })

      expect(node.properties.stamp).toEqual(value)
      expect(node.properties.stamp).not.toBe(value)
      expect(Object.isFrozen(node.properties.stamp)).toBe(false)
      expect(onPropertyChanged).toHaveBeenCalledWith(
        'stamp',
        node.properties.stamp,
        undefined
      )
    })

    it.for([
      ['a Date', { when: new Date(0) }, 'property stamp.when'],
      ['a nested NaN', { nan: Number.NaN }, 'property stamp.nan'],
      ['a nested function', { run: () => 1 }, 'property stamp.run'],
      ['a nested undefined', { gone: undefined }, 'property stamp.gone'],
      ['a toJSON', { toJSON: () => 5 }, 'property stamp.toJSON']
    ] as const)(
      'refuses %s that the workflow would save changed, and changes nothing',
      ([, value, path]) => {
        const { node, handle } = add()

        expect(() =>
          edit.updateNode(handle, { properties: { stamp: value } })
        ).toThrow(`updateNode needs ${path} as a string, a finite number`)
        expect(Object.hasOwn(node.properties, 'stamp')).toBe(false)
      }
    )

    it('deletes a property given undefined, through the node, so the workflow no longer saves it', () => {
      const { node, handle } = add()
      node.properties.stamp = 3
      node.properties.kept = 1
      const onPropertyChanged = vi.fn()
      node.onPropertyChanged = onPropertyChanged

      expect(
        edit.updateNode(handle, { properties: { stamp: undefined } })
      ).toBe(true)

      expect(Object.hasOwn(node.properties, 'stamp')).toBe(false)
      expect(node.properties).toEqual({ kept: 1 })
      expect(node.serialize().properties).toEqual({ kept: 1 })
      expect(onPropertyChanged).toHaveBeenCalledWith('stamp', undefined, 3)
      expect(history.steps).toEqual(['before', 'after'])
    })

    it('answers true for deleting a property the node does not have, and changes nothing', () => {
      const { node, handle } = add()
      node.properties.kept = 1
      const onPropertyChanged = vi.fn()
      node.onPropertyChanged = onPropertyChanged

      expect(handle.setProperty('missing', undefined)).toBe(true)

      expect(node.properties).toEqual({ kept: 1 })
      expect(onPropertyChanged).not.toHaveBeenCalled()
    })

    it('keeps a property the node refuses to delete, and answers false', () => {
      const { node, handle } = add()
      node.properties.stamp = 3
      node.onPropertyChanged = () => false

      expect(handle.setProperty('stamp', undefined)).toBe(false)

      expect(node.properties).toEqual({ stamp: 3 })
    })

    it('sets one property and deletes another in one patch, as one step', () => {
      const { node, handle } = add()
      node.properties.old = 'x'

      expect(
        edit.updateNode(handle, {
          properties: { old: undefined, fresh: 2 }
        })
      ).toBe(true)

      expect(node.properties).toEqual({ fresh: 2 })
      expect(history.steps).toEqual(['before', 'after'])
    })

    it('sets the size through the node, so its resize callback runs', () => {
      const { node, handle } = add()
      const onResize = vi.fn()
      node.onResize = onResize

      edit.updateNode(handle, { size: { width: 250, height: 90 } })

      expect(onResize).toHaveBeenCalledOnce()
      expect(handle.getSize()).toEqual({ width: 250, height: 90 })
    })

    it('accepts a size and limits of zero', () => {
      const { node, handle } = add()

      edit.updateNode(handle, {
        size: { width: 0, height: 0 },
        sizeConstraints: { minWidth: 0, maxHeight: 0 }
      })

      expect(Array.from(node.size)).toEqual([0, 0])
    })

    it('reads a point from any object with x and y, such as a handle read', () => {
      const { node, handle } = add()
      const other = add().handle
      other.setPosition({ x: 7, y: 9 })
      const position = other.getPosition()
      assert(position)

      edit.updateNode(handle, { position })

      expect(Array.from(node.pos)).toEqual([7, 9])
    })
  })

  describe('refusals', () => {
    const unusable: [string, unknown][] = [
      ['a patch that is not an object', 'title'],
      ['a patch that is null', null],
      ['a patch that is an array', []],
      ['a field the patch does not have', { label: 'x' }],
      ['a title that is not text', { title: 5 }],
      ['a mode with no name', { mode: 'muted' }],
      [
        'the host mode on-event, which ComfyUI gives no meaning',
        { mode: 'on-event' }
      ],
      ['the host mode on-trigger', { mode: 'on-trigger' }],
      ['a mode given as its number', { mode: LGraphEventMode.NEVER }],
      ['a prototype key as a mode', { mode: 'toString' }],
      ['collapsed that is not a boolean', { collapsed: 1 }],
      ['a color that is not text', { color: 7 }],
      ['a background color that is not text', { bgColor: {} }],
      ['an unknown shape', { shape: 'hexagon' }],
      ['a prototype key as a shape', { shape: 'toString' }],
      ['properties that are not an object', { properties: [1] }],
      ['a __proto__ property', { properties: JSON.parse('{"__proto__":1}') }],
      [
        'a property named as an Object member',
        { properties: { constructor: 1 } }
      ],
      ['an empty property name', { properties: { '': 1 } }],
      ['a property the workflow cannot save', { properties: { f: () => 1 } }],
      ['a circular property', { properties: { loop: circular() } }],
      ['serializeWidgets that is not a boolean', { serializeWidgets: 'yes' }],
      ['a position that is not an object', { position: 5 }],
      ['a NaN x', { position: { x: Number.NaN, y: 0 } }],
      ['an infinite y', { position: { x: 0, y: Infinity } }],
      ['a position given as text', { position: { x: '3', y: 0 } }],
      ['a missing y', { position: { x: 3 } }],
      ['a size that is null', { size: null }],
      ['a negative width', { size: { width: -1, height: 10 } }],
      ['a NaN height', { size: { width: 1, height: Number.NaN } }],
      ['a size given as an array', { size: [10, 10] }],
      ['constraints that are not an object', { sizeConstraints: 3 }],
      ['an unknown constraint', { sizeConstraints: { minDepth: 3 } }],
      ['a negative constraint', { sizeConstraints: { minWidth: -5 } }],
      ['a NaN constraint', { sizeConstraints: { maxHeight: Number.NaN } }],
      [
        'autoHeight that is not a boolean',
        { sizeConstraints: { autoHeight: 1 } }
      ],
      [
        'a minimum width above the maximum',
        { sizeConstraints: { minWidth: 9, maxWidth: 3 } }
      ],
      [
        'a minimum height above the maximum',
        { sizeConstraints: { minHeight: 9, maxHeight: 3 } }
      ],
      ['resizable that is not a boolean', { resizable: 'no' }]
    ]

    function circular() {
      const value: Record<string, unknown> = {}
      value.self = value
      return value
    }

    it.for(unusable)('refuses %s before changing anything', ([, patch]) => {
      const { node, handle } = add('Untouched')
      node.pos = [1, 2]
      node.size = [100, 50]
      node.properties.kept = 1
      const before = stateOf(node)
      const version = graph._version

      expectRefusal(
        () => Reflect.apply(edit.updateNode, undefined, [handle, patch]),
        'updateNode'
      )
      expect(stateOf(node)).toEqual(before)
      expect(graph._version).toBe(version)
      expect(history.steps).toEqual([])
    })

    it('names the call and the value it could not use', () => {
      const { handle } = add()

      expect(() =>
        Reflect.apply(edit.updateNode, undefined, [
          handle,
          { position: { x: Number.NaN, y: 0 } }
        ])
      ).toThrow('updateNode needs position.x as a finite number, not NaN.')
    })

    it.for([
      ['nothing', undefined],
      ['an id', '1'],
      ['a look-alike object', { id: '1', graphId: 'x' }]
    ])('refuses %s in place of a node handle', ([, notAHandle]) => {
      add()

      expectRefusal(
        () =>
          Reflect.apply(edit.updateNode, undefined, [
            notAHandle,
            { title: 'x' }
          ]),
        'updateNode'
      )
      expectRefusal(
        () => Reflect.apply(edit.removeNode, undefined, [notAHandle]),
        'removeNode'
      )
    })

    it('refuses a handle another API made', () => {
      const { handle } = add()
      const other = createComfyApi({ getGraph: () => graph })

      expectRefusal(
        () => other.edit.updateNode(handle, { title: 'x' }),
        'updateNode'
      )
    })
  })

  describe('a node that is gone', () => {
    it('changes nothing and says so', () => {
      const { node, handle } = add('Removed')
      graph.remove(node)
      const version = graph._version

      expect(edit.updateNode(handle, { title: 'Changed' })).toBe(false)
      expect(edit.removeNode(handle)).toBe(false)
      expect(node.title).toBe('Removed')
      expect(graph._version).toBe(version)
      expect(history.steps).toEqual([])
    })

    it('still refuses an unusable patch', () => {
      const { node, handle } = add()
      graph.remove(node)

      expectRefusal(
        () => Reflect.apply(edit.updateNode, undefined, [handle, { title: 1 }]),
        'updateNode'
      )
    })

    it('does not edit another document’s node that reuses its id', () => {
      const { node, handle } = add('First')
      graph.remove(node)
      host.beginDocument()
      const reuse = new LGraphNode('Second', 'TestNode')
      reuse.id = node.id
      graph.add(reuse)

      expect(handle.setTitle('Changed')).toBe(false)
      expect(reuse.title).toBe('Second')
    })

    it('edits a node in a subgraph that is not on screen, not the visible node with its id', () => {
      onTestFinished(enableSubgraphNodeCreation(graph))
      const { node: inner } = add('Inner')
      graph.convertToSubgraph(new Set([inner]))
      const found = comfy.graph.queryNodes({
        scope: 'root-and-subgraphs',
        type: 'TestNode'
      })
      expect(found).toHaveLength(1)
      const [handle] = found
      expect(handle.graphId).not.toBe(graph.id)
      const visible = new LGraphNode('Visible', 'TestNode')
      visible.id = inner.id
      graph.add(visible)

      expect(handle.setTitle('Edited')).toBe(true)
      expect(handle.getTitle()).toBe('Edited')
      expect(visible.title).toBe('Visible')
    })
  })

  describe('removeNode', () => {
    it('removes the node and its links as one undo step', () => {
      const { node, handle } = add()
      const target = add().node
      node.addOutput('out', 'INT')
      target.addInput('in', 'INT')
      node.connect(0, target, 0)

      expect(handle.remove()).toBe(true)

      expect(graph.getNodeById(node.id)).toBeNull()
      expect(target.isInputConnected(0)).toBe(false)
      expect(handle.isDeleted).toBe(true)
      expect(history.steps).toEqual(['before', 'after'])
    })

    it('says no when the node refuses removal', () => {
      const { node, handle } = add()
      node.ignore_remove = true

      expect(handle.remove()).toBe(false)
      expect(handle.isDeleted).toBe(false)
      expect(console.warn).toHaveBeenCalled()
    })
  })
})

describe('node handle edit methods', () => {
  let graph: LGraph
  let comfy: Comfy
  let edit: EditCore

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy, edit } = createComfyApi({ getGraph: () => graph }))
  })

  function add() {
    const node = new LGraphNode('Node', 'TestNode')
    graph.add(node)
    const handle = comfy.graph.node(String(node.id))
    assert(handle)
    return { node, handle }
  }

  const wrappers: [string, (handle: NodeHandle) => boolean, NodePatch][] = [
    ['setTitle', (h) => h.setTitle('T'), { title: 'T' }],
    ['setMode', (h) => h.setMode('never'), { mode: 'never' }],
    ['setCollapsed', (h) => h.setCollapsed(true), { collapsed: true }],
    ['setColor', (h) => h.setColor('#1'), { color: '#1' }],
    ['setBgColor', (h) => h.setBgColor('#2'), { bgColor: '#2' }],
    ['setShape', (h) => h.setShape('round'), { shape: 'round' }],
    ['setProperty', (h) => h.setProperty('p', 1), { properties: { p: 1 } }],
    [
      'setProperty with undefined',
      (h) => h.setProperty('p', undefined),
      { properties: { p: undefined } }
    ],
    [
      'setSerializeWidgets',
      (h) => h.setSerializeWidgets(true),
      { serializeWidgets: true }
    ],
    [
      'setPosition',
      (h) => h.setPosition({ x: 1, y: 2 }),
      { position: { x: 1, y: 2 } }
    ],
    [
      'setSize',
      (h) => h.setSize({ width: 3, height: 4 }),
      { size: { width: 3, height: 4 } }
    ],
    [
      'setSizeConstraints',
      (h) => h.setSizeConstraints({ minWidth: 500 }),
      { sizeConstraints: { minWidth: 500 } }
    ],
    ['setResizable', (h) => h.setResizable(false), { resizable: false }]
  ]

  it.for(wrappers)('%s is updateNode with one field', ([, wrapper, patch]) => {
    const viaHandle = add()
    const viaEdit = add()

    expect(wrapper(viaHandle.handle)).toBe(true)
    expect(edit.updateNode(viaEdit.handle, patch)).toBe(true)

    expect(viaHandle.handle.snapshot()).toEqual({
      ...viaEdit.handle.snapshot(),
      id: viaHandle.handle.id
    })
    expect(viaHandle.node.properties).toEqual(viaEdit.node.properties)
    expect(viaHandle.node.resizable).toBe(viaEdit.node.resizable)
    expect(viaHandle.node.serialize_widgets).toBe(
      viaEdit.node.serialize_widgets
    )
  })

  it.for(wrappers)('%s answers false on a removed node', ([, wrapper]) => {
    const { node, handle } = add()
    graph.remove(node)

    expect(wrapper(handle)).toBe(false)
  })

  it.for([[5], [undefined], [{}]])(
    'setProperty refuses a name that is not text: %o',
    ([name]) => {
      const { node, handle } = add()

      expectRefusal(
        () => Reflect.apply(handle.setProperty, undefined, [name, 1]),
        'setProperty'
      )
      expect(node.properties).toEqual({})
    }
  )

  it('setProperty refuses __proto__', () => {
    const { node, handle } = add()

    expectRefusal(
      () => handle.setProperty('__proto__', { polluted: true }),
      'setProperty'
    )
    expect(Reflect.get(node.properties, 'polluted')).toBeUndefined()
  })

  it('reports whether the node saves its widget values', () => {
    const { node, handle } = add()

    expect(handle.isSerializingWidgets()).toBe(false)

    handle.setSerializeWidgets(true)

    expect(handle.isSerializingWidgets()).toBe(true)
    graph.remove(node)
    expect(handle.isSerializingWidgets()).toBeUndefined()
  })

  describe('snapshot', () => {
    it('gives the node’s state now, frozen', () => {
      const { node, handle } = add()
      node.title = 'Seen'
      node.mode = LGraphEventMode.BYPASS
      node.color = '#1'
      node.shape = RenderShape.CIRCLE
      node.pos = [5, 6]
      node.size = [70, 80]
      node.collapse(true)
      node.pin(true)

      const snapshot = handle.snapshot()

      expect(snapshot).toEqual({
        id: String(node.id),
        type: 'TestNode',
        title: 'Seen',
        mode: 'bypass',
        collapsed: true,
        pinned: true,
        color: '#1',
        bgColor: undefined,
        shape: 'circle',
        position: { x: 5, y: 6 },
        size: { width: 70, height: 80 }
      })
      expect(Object.isFrozen(snapshot)).toBe(true)
      expect(Object.isFrozen(snapshot?.position)).toBe(true)
      expect(Object.isFrozen(snapshot?.size)).toBe(true)
    })

    it('names a shape it has no name for as the default, and is gone with the node', () => {
      const { node, handle } = add()
      node.shape = RenderShape.ARROW
      Reflect.set(node, 'title', 3)

      expect(handle.snapshot()).toMatchObject({
        shape: 'default',
        title: undefined
      })

      graph.remove(node)
      expect(handle.snapshot()).toBeUndefined()
    })
  })

  describe('size constraints', () => {
    it('grows and shrinks the node into the limits, once', () => {
      const { node, handle } = add()
      node.size = [100, 400]

      handle.setSizeConstraints({ minWidth: 200, maxHeight: 300 })

      expect(Array.from(node.size)).toEqual([200, 300])

      node.size = [50, 50]
      expect(Array.from(node.size)).toEqual([50, 50])
    })

    it('fits the height to what the node needs', () => {
      const { node, handle } = add()
      node.addInput('a', 'INT')
      node.addInput('b', 'INT')
      node.addInput('c', 'INT')
      node.size = [200, 10]
      const needed = node.computeSize()[1]

      handle.setSizeConstraints({ autoHeight: true })

      expect(node.size[1]).toBe(needed)
      expect(node.size[0]).toBe(200)
    })

    it('holds the fitted height within the height limits', () => {
      const { node, handle } = add()
      node.size = [200, 10]

      handle.setSizeConstraints({ autoHeight: true, minHeight: 999 })

      expect(node.size[1]).toBe(999)
    })

    it('does not resize a node already inside the limits', () => {
      const { node, handle } = add()
      node.size = [200, 100]
      const setSize = vi.spyOn(node, 'setSize')

      handle.setSizeConstraints({ minWidth: 100, maxWidth: 300 })

      expect(setSize).not.toHaveBeenCalled()
    })
  })

  describe('resizable', () => {
    it('sets the node to what the pack chose', () => {
      const { node, handle } = add()

      expect(handle.setResizable(false)).toBe(true)
      expect(node.resizable).toBe(false)
      expect(handle.setResizable(true)).toBe(true)
      expect(node.resizable).toBe(true)
    })

    it('keeps a pack’s refusal while the node is pinned, and the host’s unpin makes the node resizable again', () => {
      const { node, handle } = add()
      handle.setResizable(false)

      node.pin(true)
      expect(node.resizable).toBe(false)
      node.pin(false)

      expect(node.resizable).toBe(true)
    })

    it('keeps a pinned node from being resized when the pack allows it, until the unpin', () => {
      const { node, handle } = add()
      node.pin(true)

      handle.setResizable(true)

      expect(node.resizable).toBe(false)

      node.pin(false)

      expect(node.resizable).toBe(true)
    })

    it('keeps a refusal made after the unpin', () => {
      const { node, handle } = add()
      node.pin(true)
      node.pin(false)

      handle.setResizable(false)

      expect(node.resizable).toBe(false)
    })

    it('changes nothing once the node is gone', () => {
      const { node, handle } = add()
      graph.remove(node)

      expect(handle.setResizable(false)).toBe(false)
      expect(node.resizable).not.toBe(false)
    })
  })
})
