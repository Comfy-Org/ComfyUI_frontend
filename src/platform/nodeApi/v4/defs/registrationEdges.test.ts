import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { DefRegistry, PackId } from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

describe('registering node types and extensions at the edges', () => {
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

  function registerHost(type: string) {
    return registerHostType(host.nodeTypeHooks, hostNodeDef(type))
  }

  function registerMalformed(type: string, fields: object) {
    Reflect.apply(
      host.nodeTypeHooks.beforeRegisterNodeDef,
      host.nodeTypeHooks,
      [class extends LGraphNode {}, { ...hostNodeDef(type), ...fields }]
    )
  }

  function addedNode(type: string): LGraphNode {
    const node = LiteGraph.createNode(type)
    assert(node)
    graph.add(node)
    return node
  }

  describe('a definition the server sent malformed', () => {
    it.for([
      { name: 'outputs that are text', fields: { output: 'IMAGE' } },
      { name: 'inputs that are not an object', fields: { input: 'none' } },
      {
        name: 'an input whose spec is not a list',
        fields: { input: { required: { broken: null } } }
      },
      { name: 'output names that are text', fields: { output_name: 'out' } },
      { name: 'a category that is not text', fields: { category: 7 } }
    ])('reads $name as empty, and the others as before', ({ fields }) => {
      registerHost('Fine')
      registerMalformed('Malformed', fields)
      const applied = vi.fn()

      const stop = defs.extend(packId, /./, applied)

      expect(defs.all().map((def) => def.type)).toEqual(['Fine', 'Malformed'])
      expect(applied).toHaveBeenCalledTimes(2)
      expect(stop).toBeTypeOf('function')
      expect(reportError).not.toHaveBeenCalled()
    })

    it('keeps what it can read of a malformed definition', () => {
      registerMalformed('Malformed', {
        category: 7,
        display_name: 3,
        output_node: 'yes',
        output: ['IMAGE', 5, ['a']],
        output_name: ['image', 6],
        input: {
          required: {
            kept: ['INT', { min: 0, display_name: 4 }],
            dropped: 'INT',
            unknownOptions: ['FLOAT', 'none'],
            choices: ['COMBO', { options: ['a', 1, {}] }],
            notAList: ['COMBO', { options: 'abc' }]
          },
          hidden: 'prompt'
        }
      })

      expect(defs.get('Malformed')).toEqual({
        type: 'Malformed',
        title: 'Malformed',
        category: '',
        description: '',
        inputs: [
          {
            name: 'kept',
            type: 'INT',
            localizedName: 'kept',
            options: { min: 0, display_name: 4 }
          },
          {
            name: 'choices',
            type: 'COMBO',
            localizedName: 'choices',
            values: ['a', 1],
            options: { options: ['a', 1, {}] }
          },
          {
            name: 'notAList',
            type: 'COMBO',
            localizedName: 'notAList',
            values: [],
            options: { options: 'abc' }
          }
        ],
        outputs: [
          { name: 'image', type: 'IMAGE' },
          { name: 'COMBO', type: 'COMBO' }
        ],
        hidden: {},
        isOutputNode: false
      })
    })

    it('reports a definition whose fields cannot be read, and leaves the extension whole', () => {
      const unreadable = hostNodeDef('Unreadable')
      Object.defineProperty(unreadable, 'input', {
        get() {
          throw new Error('unreadable')
        }
      })
      host.nodeTypeHooks.beforeRegisterNodeDef(
        class extends LGraphNode {},
        unreadable
      )
      registerHost('Fine')
      const applied = vi.fn()

      const stop = defs.extend(packId, /./, applied)
      registerHost('Later')

      expect(applied.mock.calls.map(([builder]) => builder.def.type)).toEqual([
        'Fine',
        'Later'
      ])
      expect(
        vi
          .mocked(reportError)
          .mock.calls.filter(
            ([, context]) => context.errorType === 'node_api_listener_failure'
          )
      ).toHaveLength(1)
      stop()
      registerHost('AfterStop')
      expect(applied).toHaveBeenCalledTimes(2)
    })
  })

  describe('an extension that ends itself', () => {
    it('keeps no hook of an extension its own apply unsubscribed', () => {
      const onCreated = vi.fn()
      let stop = () => {}
      stop = defs.extend(packId, 'Later', (builder) => {
        builder.onCreated(onCreated)
        stop()
      })
      registerHost('Later')

      addedNode('Later')

      expect(onCreated).not.toHaveBeenCalled()
    })

    it('runs a definition’s hooks only for the nodes of its own registration', () => {
      const heard: string[] = []
      const first = defs.define(packId, {
        type: 'Redefined',
        onRemoved: () => heard.push('first')
      })
      const earlier = addedNode('Redefined')
      first()
      defs.define(packId, {
        type: 'Redefined',
        onRemoved: () => heard.push('second')
      })
      const later = addedNode('Redefined')

      graph.remove(earlier)
      graph.remove(later)

      expect(heard).toEqual(['second'])
    })
  })

  describe('an apply that returns a promise', () => {
    it('reports its rejection', async () => {
      const broken = new Error('async apply failed')
      registerHost('Pick')

      Reflect.apply(defs.extend, defs, [
        packId,
        'Pick',
        async () => {
          await Promise.resolve()
          throw broken
        }
      ])
      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(
          broken,
          expect.objectContaining({ tags: { event: 'extend' } })
        )
      )
    })
  })

  describe('a value whose reads throw', () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('trap')
        },
        ownKeys() {
          throw new Error('trap')
        }
      }
    )

    it('is refused with a TypeError as a selector, a definition and a menu item', () => {
      registerHost('Pick')
      let menuRefusal: unknown
      defs.extend(packId, 'Pick', (builder) => {
        try {
          Reflect.apply(builder.addMenuItem, builder, [hostile])
        } catch (error) {
          menuRefusal = error
        }
      })

      expectRefusal(
        () => Reflect.apply(defs.extend, defs, [packId, hostile, () => {}]),
        'extend'
      )
      expectRefusal(
        () => Reflect.apply(defs.define, defs, [packId, hostile]),
        'define'
      )
      expect(menuRefusal).toBeInstanceOf(TypeError)
    })
  })

  describe('the order of hooks on a type', () => {
    it('keeps the order of the extensions however they were made', () => {
      const order: string[] = []
      let innerMade = false
      defs.extend(packId, 'Pick', (builder) => {
        builder.onCreated(() => order.push('outer'))
        if (!innerMade) {
          innerMade = true
          defs.extend(packId, 'Pick', (inner) =>
            inner.onCreated(() => order.push('inner'))
          )
        }
      })
      registerHost('Pick')
      addedNode('Pick')
      const first = [...order]
      order.length = 0

      registerHost('Pick')
      addedNode('Pick')

      expect(first).toEqual(['outer', 'inner'])
      expect(order).toEqual(['outer', 'inner'])
    })

    it('runs a definition’s own hooks before an extension made earlier', () => {
      const order: string[] = []
      defs.extend(packId, 'Defined', (builder) =>
        builder.onCreated(() => order.push('extension'))
      )
      defs.define(packId, {
        type: 'Defined',
        onCreated: () => order.push('own')
      })

      addedNode('Defined')

      expect(order).toEqual(['own', 'extension'])
    })
  })

  describe('a definition and a host type of the same name', () => {
    it('runs the definition’s hooks only for the type it defined', () => {
      const onCreated = vi.fn()
      defs.define(packId, { type: 'Shared', onCreated })
      registerHost('Shared')

      addedNode('Shared')

      expect(onCreated).not.toHaveBeenCalled()
    })
  })

  it('refuses a revoked Proxy with a TypeError naming the member, as a selector, a definition and a menu item', () => {
    function revoked(): object {
      const { proxy, revoke } = Proxy.revocable({}, {})
      revoke()
      return proxy
    }
    registerHost('Revoked')
    let menuRefusal: unknown
    defs.extend(packId, 'Revoked', (builder) => {
      try {
        Reflect.apply(builder.addMenuItem, builder, [revoked()])
      } catch (error) {
        menuRefusal = error
      }
    })

    expect(() =>
      Reflect.apply(defs.extend, defs, [packId, revoked(), () => {}])
    ).toThrow(/^extend needs/)
    expect(() => Reflect.apply(defs.define, defs, [packId, revoked()])).toThrow(
      /^define needs/
    )
    expect(String(menuRefusal)).toMatch(/^TypeError: addMenuItem needs/)
  })
})
