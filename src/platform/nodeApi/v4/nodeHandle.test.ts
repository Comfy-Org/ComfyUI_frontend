import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { reportError } from '@comfyorg/telemetry/reportError'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { isProxy } from 'vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  createMockCanvasRenderingContext2D,
  stubCanvasGetContext
} from '@/utils/__tests__/canvasTestUtils'

import { createComfyApi } from './comfyApi'
import type { ComfyApiHost } from './comfyApi'
import type { Comfy, NodeHandle } from './types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

describe('node handles', () => {
  let graph: LGraph
  let comfy: Comfy
  let host: ComfyApiHost

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy, host } = createComfyApi({ getGraph: () => graph }))
  })

  function add(title = 'Node', type = 'TestNode') {
    const node = new LGraphNode(title, type)
    graph.add(node)
    const handle = comfy.graph.node(node.id)
    assert(handle)
    return { node, handle }
  }

  describe('identity', () => {
    it('names the node by its id and its graph', () => {
      const { node, handle } = add()

      expect(handle.id).toBe(String(node.id))
      expect(handle.graphId).toBe(graph.id)
      expect(handle.isDeleted).toBe(false)
    })

    it('reports the type, and the backend class when it differs', () => {
      const { node, handle } = add('Loader', 'Pack/Loader')

      expect(handle.type).toBe('Pack/Loader')
      expect(handle.comfyClass).toBe('Pack/Loader')

      node.comfyClass = 'PackLoader'

      expect(handle.comfyClass).toBe('PackLoader')
    })

    it('cannot be changed by a pack', () => {
      const { handle } = add()

      expect(Object.isFrozen(handle)).toBe(true)
    })
  })

  describe('reads', () => {
    it('reads the live node each time it is asked', () => {
      const { node, handle } = add('Before')

      expect(handle.getTitle()).toBe('Before')

      node.title = 'After'

      expect(handle.getTitle()).toBe('After')
    })

    it.for([
      { mode: LGraphEventMode.ALWAYS, name: 'always' },
      { mode: LGraphEventMode.NEVER, name: 'never' },
      { mode: LGraphEventMode.BYPASS, name: 'bypass' }
    ])('names mode $mode as $name', ({ mode, name }) => {
      const { node, handle } = add()
      node.mode = mode

      expect(handle.getMode()).toBe(name)
    })

    it.for([
      LGraphEventMode.ON_EVENT,
      LGraphEventMode.ON_TRIGGER,
      'toString',
      'constructor',
      '__proto__',
      99
    ])(
      'reads a mode with no public name, %s, as undefined in the handle and its snapshot',
      (mode) => {
        const { node, handle } = add()
        Reflect.set(node, 'mode', mode)

        expect(handle.getMode()).toBeUndefined()
        expect(handle.snapshot()?.mode).toBeUndefined()
      }
    )

    it('reads a title or color a malformed workflow stored as something else as undefined', () => {
      const { node, handle } = add('Titled')
      Reflect.set(node, 'title', 42)
      Reflect.set(node, 'color', { not: 'a string' })
      Reflect.set(node, 'bgcolor', 7)

      expect(handle.getTitle()).toBeUndefined()
      expect(handle.getColor()).toBeUndefined()
      expect(handle.getBgColor()).toBeUndefined()
    })

    it('reports collapsed and pinned as booleans', () => {
      const { node, handle } = add()

      expect([handle.isCollapsed(), handle.isPinned()]).toEqual([false, false])

      node.flags.collapsed = true
      node.flags.pinned = true

      expect([handle.isCollapsed(), handle.isPinned()]).toEqual([true, true])
    })

    it('reports collapsed and pinned independently', () => {
      const { node, handle } = add()

      node.flags.pinned = true

      expect([handle.isCollapsed(), handle.isPinned()]).toEqual([false, true])
    })

    it('reports the colors, or nothing for the defaults', () => {
      const { node, handle } = add()

      expect([handle.getColor(), handle.getBgColor()]).toEqual([
        undefined,
        undefined
      ])

      node.color = '#223'
      node.bgcolor = '#335'

      expect([handle.getColor(), handle.getBgColor()]).toEqual(['#223', '#335'])
    })

    it('reads a saved property, and nothing for a name the node does not have', () => {
      const { node, handle } = add()
      node.properties.amount = 3

      expect(handle.getProperty('amount')).toBe(3)
      expect(handle.getProperty('missing')).toBeUndefined()
      expect(handle.getProperty('toString')).toBeUndefined()
      expect(handle.getProperty('__proto__')).toBeUndefined()
    })

    it('gives a copy of the properties that cannot change the node', () => {
      const { node, handle } = add()
      node.properties.amount = 3

      const copy = handle.getProperties()

      expect(copy).toEqual({ amount: 3 })
      expect(Object.isFrozen(copy)).toBe(true)
      expect(copy).not.toBe(node.properties)
    })

    it('copies property values all the way down, as the workflow would save them', () => {
      const { node, handle } = add()
      node.properties.camera = { position: [1, 2] }

      const value = handle.getProperty('camera')
      const camera = handle.getProperties()?.camera

      expect(value).toEqual({ position: [1, 2] })
      expect(camera).toEqual({ position: [1, 2] })
      expect(isProxy(value)).toBe(false)
      expect(Object.isFrozen(value)).toBe(true)
      expect(Object.isFrozen(Reflect.get(Object(camera), 'position'))).toBe(
        true
      )
      expect(value).not.toBe(camera)
    })

    it.for([[['amount']], [{}], [undefined], [3]])(
      'refuses a property name that is not a string, even on a removed node: %o',
      ([name]) => {
        const { node, handle } = add()
        node.properties.amount = 3
        const getProperty = (): unknown =>
          Reflect.apply(handle.getProperty, handle, [name])

        expectRefusal(getProperty, 'getProperty')
        graph.remove(node)
        expectRefusal(getProperty, 'getProperty')
      }
    )

    it('reads a property the workflow could not save as undefined, and reports it once for each member', () => {
      const { node, handle } = add()
      const circular: Record<string, unknown> = {}
      circular.itself = circular
      node.properties.circular = circular
      Reflect.set(node.properties, 'big', 10n)
      node.properties.fine = 3

      expect(handle.getProperty('circular')).toBeUndefined()
      expect(handle.getProperty('circular')).toBeUndefined()
      expect(handle.getProperty('big')).toBeUndefined()
      expect(handle.getProperty('fine')).toBe(3)
      expect(handle.getProperties()).toBeUndefined()
      expect(handle.getProperties()).toBeUndefined()

      expect(reportError).toHaveBeenCalledTimes(2)
      expect(reportError).toHaveBeenCalledWith(expect.any(TypeError), {
        errorType: 'node_api_property_not_savable',
        surface: 'platform',
        level: 'warning',
        tags: { member: 'getProperty' }
      })
    })

    it('reads a value whose toJSON throws something that is not an error as undefined', () => {
      const { node, handle } = add()
      node.properties.odd = {
        toJSON() {
          throw Object.create(null)
        }
      }

      expect(handle.getProperty('odd')).toBeUndefined()
      expect(handle.getProperties()).toBeUndefined()
    })

    it('reports an unsavable value once however its error message varies', () => {
      const { node, handle } = add()
      const failing = (message: string) => ({
        toJSON() {
          throw new Error(message)
        }
      })

      node.properties.changing = failing('first failure')
      expect(handle.getProperty('changing')).toBeUndefined()
      node.properties.changing = failing('second failure')
      expect(handle.getProperty('changing')).toBeUndefined()

      expect(reportError).toHaveBeenCalledOnce()
    })

    it('reads a property whose getter throws as undefined, and reports it', () => {
      const { node, handle } = add()
      Object.defineProperty(node.properties, 'broken', {
        enumerable: true,
        get() {
          throw new Error('getter failed')
        }
      })

      expect(handle.getProperty('broken')).toBeUndefined()
      expect(reportError).toHaveBeenCalledOnce()
    })

    it('copies text inside a property value, and reads a property saved as undefined, one named like an Object member included', () => {
      const { node, handle } = add()
      node.properties.label = { text: 'Seed' }
      node.properties.unset = undefined
      Object.assign(node.properties, { constructor: undefined })

      expect(handle.getProperties()).toEqual({ label: { text: 'Seed' } })
      expect(handle.getProperty('label')).toEqual({ text: 'Seed' })
      expect(handle.getProperty('unset')).toBeUndefined()
      expect(handle.getProperty('constructor')).toBeUndefined()
    })

    it('reads one property as the workflow would save it', () => {
      const { node, handle } = add()
      node.properties.nan = Number.NaN
      node.properties.callback = () => 1
      node.properties.count = 3

      expect(handle.getProperty('nan')).toBeNull()
      expect(handle.getProperty('callback')).toBeUndefined()
      expect(handle.getProperty('count')).toBe(3)
      expect(handle.getProperties()).toEqual({ nan: null, count: 3 })
    })

    it('reads a property whose toJSON reads its key as the workflow saves it, under its own name', () => {
      const { node, handle } = add()
      node.properties.label = { toJSON: (key: string) => key }

      expect(handle.getProperty('label')).toBe('label')
      expect(handle.getProperties()).toEqual({ label: 'label' })
      expect(JSON.parse(JSON.stringify(node.serialize())).properties).toEqual({
        label: 'label'
      })
    })

    it('reports where the node is and how big, as values that cannot change it', () => {
      const { node, handle } = add()
      node.pos = [100, 200]
      node.size = [300, 120]

      expect(handle.getPosition()).toEqual({ x: 100, y: 200 })
      expect(handle.getSize()).toEqual({ width: 300, height: 120 })
      expect(Object.isFrozen(handle.getPosition())).toBe(true)
      expect(Object.isFrozen(handle.getSize())).toBe(true)
    })

    it('includes the title bar in the bounds', () => {
      const { node, handle } = add()
      node.pos = [100, 200]
      node.size = [300, 120]
      const titleBar = LiteGraph.NODE_TITLE_HEIGHT

      expect(titleBar).toBeGreaterThan(0)
      expect(handle.getBounds()).toEqual({
        x: 100,
        y: 200 - titleBar,
        width: 300,
        height: 120 + titleBar
      })
      expect(Object.isFrozen(handle.getBounds())).toBe(true)
    })

    it('reads the bounds of a collapsed node without changing what the canvas drew', () => {
      const context = createMockCanvasRenderingContext2D()
      stubCanvasGetContext()
      const { node, handle } = add()
      node.pos = [100, 200]
      node.size = [300, 120]
      node.flags.collapsed = true
      node.updateArea(context)
      const drawn = Array.from(node.boundingRect)
      const drawnWidth = node._collapsed_width
      node.onBounding = vi.fn()

      const bounds = handle.getBounds()

      expect(drawn[2]).not.toBe(LiteGraph.NODE_COLLAPSED_WIDTH)
      expect(bounds).toEqual({
        x: drawn[0],
        y: drawn[1],
        width: drawn[2],
        height: drawn[3]
      })
      expect(Array.from(node.boundingRect)).toEqual(drawn)
      expect(node._collapsed_width).toBe(drawnWidth)
      expect(drawnWidth).toBeGreaterThan(0)
      expect(Array.from(node.size)).toEqual([300, 120])
      expect(node.onBounding).not.toHaveBeenCalled()
    })

    it('measures an expanded node afresh, so a move since the last frame shows', () => {
      const { node, handle } = add()
      node.size = [300, 120]
      node.updateArea()
      node.pos = [500, 600]

      expect(handle.getBounds()).toMatchObject({
        x: 500,
        y: 600 - LiteGraph.NODE_TITLE_HEIGHT
      })
    })

    it('measures a collapsed node on the Vue canvas, which does not keep a drawn rectangle', () => {
      const { node, handle } = add()
      node.pos = [100, 200]
      node.size = [300, 120]
      node.flags.collapsed = true
      node.updateArea(createMockCanvasRenderingContext2D())
      const staleWidth = node.boundingRect[2]
      node._collapsed_width = 90
      LiteGraph.vueNodesMode = true
      onTestFinished(() => {
        LiteGraph.vueNodesMode = false
      })

      expect(handle.getBounds()?.width).toBe(90)
      expect(staleWidth).not.toBe(90)
    })
  })

  it('measures a collapsed node no frame has drawn at the width the canvas draws it', () => {
    const context = createMockCanvasRenderingContext2D()
    stubCanvasGetContext()
    const { node, handle } = add()
    node.pos = [100, 200]
    node.size = [300, 120]
    node.flags.collapsed = true

    const bounds = handle.getBounds()
    const collapsedWidthBeforeDrawing = node._collapsed_width
    const boundingRectBeforeDrawing = Array.from(node.boundingRect)
    node.updateArea(context)

    expect(collapsedWidthBeforeDrawing).toBeUndefined()
    expect(boundingRectBeforeDrawing).toEqual([0, 0, 0, 0])
    expect(node.boundingRect[2]).not.toBe(LiteGraph.NODE_COLLAPSED_WIDTH)
    expect(bounds).toEqual({
      x: node.boundingRect[0],
      y: node.boundingRect[1],
      width: node.boundingRect[2],
      height: node.boundingRect[3]
    })
  })

  it('reports where a collapsed node is now, not where the last frame drew it', () => {
    const context = createMockCanvasRenderingContext2D()
    stubCanvasGetContext()
    const { node, handle } = add()
    node.size = [300, 120]
    node.flags.collapsed = true
    node.updateArea(context)
    node.pos = [500, 600]

    expect(handle.getBounds()).toMatchObject({
      x: 500,
      y: 600 - LiteGraph.NODE_TITLE_HEIGHT
    })
  })

  describe('lifetime', () => {
    it('is a different entity once Convert to Subgraph moves the node to another graph', () => {
      onTestFinished(enableSubgraphNodeCreation(graph))
      const { node, handle } = add('Moved')

      const { subgraph } = graph.convertToSubgraph(new Set([node]))

      expect(handle.isDeleted).toBe(true)
      const inSubgraph = comfy.graph.queryNodes({
        scope: 'root-and-subgraphs',
        type: 'TestNode'
      })
      expect(inSubgraph).toHaveLength(1)
      expect(inSubgraph[0].graphId).toBe(subgraph.id)
      expect(inSubgraph[0]).not.toBe(handle)
    })

    const reads: [string, (handle: NodeHandle) => unknown][] = [
      ['type', (handle) => handle.type],
      ['comfyClass', (handle) => handle.comfyClass],
      ['getTitle', (handle) => handle.getTitle()],
      ['getMode', (handle) => handle.getMode()],
      ['isCollapsed', (handle) => handle.isCollapsed()],
      ['isPinned', (handle) => handle.isPinned()],
      ['getColor', (handle) => handle.getColor()],
      ['getBgColor', (handle) => handle.getBgColor()],
      ['getProperty', (handle) => handle.getProperty('amount')],
      ['getProperties', (handle) => handle.getProperties()],
      ['getPosition', (handle) => handle.getPosition()],
      ['getSize', (handle) => handle.getSize()],
      ['getBounds', (handle) => handle.getBounds()]
    ]

    it.for(reads)(
      'answers %s with nothing once the node is removed',
      ([, read]) => {
        const { node, handle } = add()
        node.color = '#223'
        node.bgcolor = '#335'
        node.properties.amount = 3
        expect(read(handle)).toBeDefined()

        graph.remove(node)

        expect(read(handle)).toBeUndefined()
      }
    )

    it('still names a removed node, and says it is deleted', () => {
      const { node, handle } = add()

      graph.remove(node)

      expect(handle.isDeleted).toBe(true)
      expect(handle.id).toBe(String(node.id))
      expect(handle.graphId).toBe(graph.id)
    })

    it('follows its node through undo, which rebuilds the node as a new object', () => {
      const { node, handle } = add('Kept')

      graph.configure(graph.serialize())

      expect(graph.getNodeById(node.id)).not.toBe(node)
      expect(handle.isDeleted).toBe(false)
      expect(handle.getTitle()).toBe('Kept')
    })

    it('comes back with its node when the graph is rebuilt with it again', () => {
      const { node, handle } = add('Removed, then restored')
      const beforeRemoval = graph.serialize()

      graph.remove(node)

      expect(handle.isDeleted).toBe(true)

      graph.configure(beforeRemoval)

      expect(handle.isDeleted).toBe(false)
      expect(handle.getTitle()).toBe('Removed, then restored')
    })

    it('is retired when another document reuses its id', () => {
      const { node, handle } = add('First')
      const sameId = new LGraphNode('Second', 'TestNode')
      sameId.id = node.id

      graph.remove(node)
      host.beginDocument()
      graph.add(sameId)

      expect(graph.getNodeById(node.id)).toBe(sameId)
      expect(handle.isDeleted).toBe(true)
      expect(handle.getTitle()).toBeUndefined()
      expect(comfy.graph.node(sameId.id)?.getTitle()).toBe('Second')
    })
  })
})
