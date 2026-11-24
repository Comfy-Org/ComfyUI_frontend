import { reportError } from '@comfyorg/telemetry/reportError'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { withGraphIntentSource } from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  IContextMenuValue,
  LGraphCanvas
} from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import { mergeCustomNodesI18n } from '@/i18n'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type {
  DefRegistry,
  ExecutionResult,
  NodeCreatedEvent,
  NodeDef,
  NodeDefBuilder,
  PackId
} from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

let serial = 0
const fresh = (stem: string) => `Details/${stem}${++serial}`

describe('contract details', () => {
  let graph: LGraph
  let defs: DefRegistry
  let host: ComfyApiHost

  let packId: PackId

  beforeEach(() => {
    graph = new LGraph()
    const api = createComfyApi({ getGraph: () => graph })
    packId = registerTestPack(api)
    defs = api.comfy.defs
    host = api.host
  })

  function hostType(category = 'testing') {
    const type = fresh('Type')
    registerHostType(host.nodeTypeHooks, hostNodeDef(type, { category }))
    return type
  }

  function added(type: string): LGraphNode {
    const node = LiteGraph.createNode(type)
    assert(node)
    graph.add(node)
    return node
  }

  function refusalInApply(
    type: string,
    use: (builder: NodeDefBuilder) => void
  ) {
    let refusal: unknown
    defs.extend(packId, type, (builder) => {
      try {
        use(builder)
      } catch (error) {
        refusal = error
      }
    })
    return refusal
  }

  function menuOptions(entry: IContextMenuValue | undefined) {
    return (entry?.submenu?.options ?? []).filter(
      (option): option is IContextMenuValue =>
        typeof option === 'object' && option !== null
    )
  }

  function click(entry: IContextMenuValue | undefined) {
    assert(entry?.callback)
    void Reflect.apply(entry.callback, null, [])
  }

  describe('selectors', () => {
    it('refuses a list holding an object', () => {
      expectRefusal(
        () => Reflect.apply(defs.extend, defs, [packId, ['A', {}], () => {}]),
        'extend'
      )
    })

    it('picks a category by its whole name, not a prefix of it', () => {
      const picked: string[] = []
      defs.extend(packId, { category: 'mine' }, (builder) =>
        picked.push(builder.def.category)
      )

      hostType('mine/sub')
      hostType('mine')

      expect(picked).toEqual(['mine'])
    })

    it('drops the sticky flag of a pattern', () => {
      const picked: string[] = []
      defs.extend(packId, /Sticky/y, (builder) => picked.push(builder.def.type))

      registerHostType(host.nodeTypeHooks, hostNodeDef('A/Sticky'))

      expect(picked).toEqual(['A/Sticky'])
    })

    it('picks a defined type by its category', () => {
      const picked: string[] = []
      defs.extend(packId, { category: 'PackCategory' }, (builder) =>
        picked.push(builder.def.type)
      )
      const type = fresh('Defined')

      defs.define(packId, { type, category: 'PackCategory' })

      expect(picked).toEqual([type])
    })

    it('builds one definition for every extension applied in one registration', () => {
      const seen: NodeDef[] = []
      defs.extend(packId, /^Details\/Once/, (builder) => seen.push(builder.def))
      defs.extend(packId, /^Details\/Once/, (builder) => seen.push(builder.def))

      registerHostType(host.nodeTypeHooks, hostNodeDef(fresh('Once')))

      expect(seen).toHaveLength(2)
      expect(seen[0]).toBe(seen[1])
    })
  })

  describe('refusals', () => {
    it('refuses a hook that is an object', () => {
      const refusal = refusalInApply(hostType(), (builder) =>
        Reflect.apply(builder.onCreated, builder, [{}])
      )

      expect(refusal).toBeInstanceOf(TypeError)
    })

    it.for<{ name: string; item: object }>([
      {
        name: 'an instance of a class',
        item: new (class Item {
          label = 'x'
          run() {}
        })()
      },
      {
        name: 'a field Object.prototype has',
        item: { label: 'x', run: () => {}, toString: () => '' }
      },
      { name: 'a label that is an object', item: { label: {}, run: () => {} } }
    ])('refuses a menu item with $name', ({ item }) => {
      const refusal = refusalInApply(hostType(), (builder) =>
        Reflect.apply(builder.addMenuItem, builder, [item])
      )

      expect(refusal).toBeInstanceOf(TypeError)
    })

    it('refuses a definition with a field Object.prototype has', () => {
      expectRefusal(
        () =>
          Reflect.apply(defs.define, defs, [
            packId,
            { type: fresh('Defined'), toString: () => '' }
          ]),
        'define'
      )
    })
  })

  describe('a type keeps its own methods', () => {
    it('calls what the class had before each dispatcher', () => {
      const own: string[] = []
      class Own extends LGraphNode {
        override onConfigure() {
          own.push('onConfigure')
        }
        override onExecuted() {
          own.push('onExecuted')
        }
        override onSerialize() {
          own.push('onSerialize')
        }
        override onResize() {
          own.push('onResize')
        }
        override onConnectionsChange() {
          own.push('onConnectionsChange')
        }
        override onMouseEnter() {
          own.push('onMouseEnter')
        }
        override onMouseLeave() {
          own.push('onMouseLeave')
        }
        override onDblClick() {
          own.push('onDblClick')
        }
      }
      const type = fresh('Own')
      host.nodeTypeHooks.beforeRegisterNodeDef(Own, hostNodeDef(type))
      LiteGraph.registerNodeType(type, Own)
      defs.extend(packId, type, (builder) => {
        builder.onConfigured(() => {})
        builder.onExecuted(() => {})
        builder.onSerialize(() => {})
        builder.onResized(() => {})
        builder.onConnectionsChanged(() => {})
        builder.onHover(() => {})
        builder.onDoubleClick(() => {})
      })
      const node = added(type)
      node.addInput('in', '*')
      const from = new LGraphNode('From')
      from.addOutput('out', '*')
      graph.add(from)
      const pointer = fromPartial<CanvasPointerEvent>({})
      own.length = 0

      node.configure(node.serialize())
      node.onExecuted?.({})
      node.setSize([300, 200])
      from.connect(0, node, 0)
      node.onMouseEnter?.(pointer)
      node.onMouseLeave?.(pointer)
      node.onDblClick?.(pointer, [0, 0], fromPartial<LGraphCanvas>({}))

      expect(new Set(own)).toEqual(
        new Set([
          'onConfigure',
          'onExecuted',
          'onSerialize',
          'onResize',
          'onConnectionsChange',
          'onMouseEnter',
          'onMouseLeave',
          'onDblClick'
        ])
      )
    })
  })

  describe('lifecycle', () => {
    it('says a node another client added is not loading', () => {
      const type = hostType()
      const events: NodeCreatedEvent[] = []
      defs.extend(packId, type, (builder) =>
        builder.onCreated((_, event) => events.push(event))
      )
      const node = LiteGraph.createNode(type)
      assert(node)

      withGraphIntentSource('agent-remote', () => graph.add(node))

      expect(events).toEqual([{ restored: false, loading: false }])
    })

    it('gives an empty raw result for output that is a list', () => {
      const type = hostType()
      const results: ExecutionResult[] = []
      defs.extend(packId, type, (builder) =>
        builder.onExecuted((_, result) => results.push(result))
      )
      const node = added(type)

      const onExecuted = node.onExecuted
      assert(onExecuted)
      Reflect.apply(onExecuted, node, [['not', 'an', 'object']])

      expect(results.map((result) => result.raw)).toEqual([{}])
    })

    it('stops every hook on a defined type once its definition is unsubscribed', () => {
      const type = fresh('Gone')
      const stop = defs.define(packId, { type })
      const onRemoved = vi.fn()
      defs.extend(packId, type, (builder) => builder.onRemoved(onRemoved))
      const node = added(type)

      stop()
      graph.remove(node)

      expect(onRemoved).not.toHaveBeenCalled()
    })

    it('gives a defined class the description its definition declares', () => {
      const type = fresh('Described')

      defs.define(packId, { type, description: 'Says what it does' })

      expect(LiteGraph.registered_node_types[type].description).toBe(
        'Says what it does'
      )
    })
  })

  describe('properties', () => {
    it('stores a copy of the value a hook gives, as setProperty does', () => {
      const type = hostType()
      const replacement = { nested: [1] }
      defs.extend(packId, type, (builder) =>
        builder.onPropertyChanged((_, event) => event.setValue(replacement))
      )
      const node = added(type)

      node.setProperty('shape', 1)

      expect(node.properties.shape).toEqual(replacement)
      expect(node.properties.shape).not.toBe(replacement)
      expect(Object.isFrozen(node.properties.shape)).toBe(false)
    })
  })

  describe('menus', () => {
    it('leaves out a submenu function whose entries are not { label, run }', () => {
      const type = hostType()
      defs.extend(packId, type, (builder) =>
        Reflect.apply(builder.addMenuItem, builder, [
          {
            label: 'Sub',
            items: () => [{ label: 'a', run: () => {}, extra: 1 }]
          }
        ])
      )

      expect(host.nodeTypeHooks.getNodeMenuItems(added(type))).toEqual([])
      expect(reportError).toHaveBeenCalled()
    })

    it('reports a submenu entry that throws, and runs none for a removed node', () => {
      const run = vi.fn(() => {
        throw new Error('child failed')
      })
      const type = hostType()
      defs.extend(packId, type, (builder) =>
        builder.addMenuItem({ label: 'Sub', items: [{ label: 'a', run }] })
      )
      const node = added(type)
      const [child] = menuOptions(host.nodeTypeHooks.getNodeMenuItems(node)[0])

      click(child)

      expect(reportError).toHaveBeenCalled()

      graph.remove(node)
      run.mockClear()
      click(child)

      expect(run).not.toHaveBeenCalled()
    })
  })

  describe('reading definitions', () => {
    it('gives combo values as a frozen copy', () => {
      const values = ['a', 'b']
      const type = fresh('Combo')
      registerHostType(
        host.nodeTypeHooks,
        hostNodeDef(type, { input: { required: { pick: [values] } } })
      )

      const [input] = defs.get(type)?.inputs ?? []

      expect(input.values).toEqual(['a', 'b'])
      expect(input.values).not.toBe(values)
      expect(Object.isFrozen(input.values)).toBe(true)
    })

    it('gives the title, description and input label the editor shows in the user language', () => {
      const type = `DetailsShown${++serial}`
      mergeCustomNodesI18n({
        en: {
          nodeDefs: {
            [type]: {
              display_name: 'Shown title',
              description: 'Shown description',
              inputs: { seed: { name: 'Shown seed' } }
            }
          }
        }
      })
      registerHostType(
        host.nodeTypeHooks,
        hostNodeDef(type, {
          display_name: 'Server title',
          description: 'Server description',
          input: { required: { seed: ['INT', {}] } }
        })
      )

      const def = defs.get(type)

      expect(def?.title).toBe('Shown title')
      expect(def?.description).toBe('Shown description')
      expect(def?.inputs[0].localizedName).toBe('Shown seed')
    })
  })
})
