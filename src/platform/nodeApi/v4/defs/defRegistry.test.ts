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

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type {
  DefRegistry,
  NodeDef,
  NodeDefBuilder,
  PackId
} from '@/platform/nodeApi/v4/types'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

describe('node definitions', () => {
  let defs: DefRegistry
  let host: ComfyApiHost

  let packId: PackId

  beforeEach(() => {
    const api = createComfyApi({ getGraph: () => null })
    packId = registerTestPack(api)
    defs = api.comfy.defs
    host = api.host
  })

  function registerHost(name: string, category = 'testing') {
    return registerHostType(host.nodeTypeHooks, hostNodeDef(name, { category }))
  }

  function typesExtended(selector: Parameters<DefRegistry['extend']>[1]) {
    const types: string[] = []
    const stop = defs.extend(packId, selector, (builder) =>
      types.push(builder.def.type)
    )
    return { types, stop }
  }

  describe('extend', () => {
    it('applies to a type the host registers later', () => {
      const { types } = typesExtended('KSampler')

      registerHost('KSampler')

      expect(types).toEqual(['KSampler'])
    })

    it('applies at once to a type the host has registered already', () => {
      registerHost('KSampler')

      const { types } = typesExtended('KSampler')

      expect(types).toEqual(['KSampler'])
    })

    it('applies to a type a pack defines', () => {
      const { types } = typesExtended('Pack/Label')

      onTestFinished(defs.define(packId, { type: 'Pack/Label' }))

      expect(types).toEqual(['Pack/Label'])
    })

    it('applies again with the new definition when the host registers a type again', () => {
      const titles: string[] = []
      onTestFinished(
        defs.extend(packId, 'KSampler', (builder) =>
          titles.push(builder.def.title)
        )
      )

      registerHostType(
        host.nodeTypeHooks,
        hostNodeDef('KSampler', { display_name: 'Before' })
      )
      registerHostType(
        host.nodeTypeHooks,
        hostNodeDef('KSampler', { display_name: 'After' })
      )

      expect(titles).toEqual(['Before', 'After'])
    })

    it.for([
      { name: 'a type name', selector: 'Pick', picked: ['Pick'] },
      {
        name: 'a list of names',
        selector: ['Pick', 'Also'],
        picked: ['Pick', 'Also']
      },
      { name: 'a pattern', selector: /^P/, picked: ['Pick'] },
      {
        name: 'a category',
        selector: { category: 'mine' },
        picked: ['Pick', 'Also']
      },
      {
        name: 'a category pattern',
        selector: { category: /^other/ },
        picked: ['Skip']
      },
      {
        name: 'a test of the definition',
        selector: (def: NodeDef) => def.type.length === 4,
        picked: ['Pick', 'Also', 'Skip']
      }
    ])('picks types by $name', ({ selector, picked }) => {
      registerHost('Pick', 'mine')
      registerHost('Also', 'mine')
      registerHost('Skip', 'other/sub')

      expect(typesExtended(selector).types).toEqual(picked)
    })

    it('tests a global category pattern the same way for each type', () => {
      const { types } = typesExtended({ category: /^mine/g })

      registerHost('First', 'mine')
      registerHost('Second', 'mine')

      expect(types).toEqual(['First', 'Second'])
    })

    it('names the selector forms when it refuses an object without a category', () => {
      expect(() =>
        Reflect.apply(defs.extend, defs, [packId, { type: 'Pick' }, () => {}])
      ).toThrow(
        'extend needs a type name, a list of names, a RegExp, { category } or a function'
      )
    })

    it('does not apply an extension another apply unsubscribed during the same registration', () => {
      const later = vi.fn()
      let stopLater = () => {}
      onTestFinished(defs.extend(packId, 'Pick', () => stopLater()))
      stopLater = defs.extend(packId, 'Pick', later)

      registerHost('Pick')

      expect(later).not.toHaveBeenCalled()
    })

    it('applies an extension made by an apply during a registration once to that type', () => {
      const nested = vi.fn()
      onTestFinished(
        defs.extend(packId, 'Second', () => {
          onTestFinished(defs.extend(packId, /./, nested))
        })
      )

      registerHost('Second')

      expect(nested).toHaveBeenCalledOnce()
    })

    it('tests a global pattern the same way for each type', () => {
      const { types } = typesExtended(/^P/g)

      registerHost('Pick')
      registerHost('Pack')

      expect(types).toEqual(['Pick', 'Pack'])
    })

    it('gives a selector test the definition, and skips a type whose test throws', () => {
      const broken = new Error('selector failed')
      const seen: NodeDef[] = []
      registerHost('First')
      registerHost('Second')

      const { types } = typesExtended((def) => {
        seen.push(def)
        if (def.type === 'First') throw broken
        return true
      })

      expect(seen.map((def) => def.type)).toEqual(['First', 'Second'])
      expect(types).toEqual(['Second'])
      expect(reportError).toHaveBeenCalledWith(
        broken,
        expect.objectContaining({ tags: { event: 'extend selector' } })
      )
    })

    it('does not pick a type when a selector test returns something other than true', () => {
      registerHost('Pick')
      const apply = vi.fn()

      Reflect.apply(defs.extend, defs, [packId, () => 'yes', apply])

      expect(apply).not.toHaveBeenCalled()
    })

    it.for([
      { name: 'a number', selector: 5 },
      { name: 'null', selector: null },
      { name: 'an empty object', selector: {} },
      { name: 'a category that is not text', selector: { category: 5 } },
      { name: 'more than a category', selector: { category: 'a', type: 'b' } },
      { name: 'a list holding a number', selector: ['Pick', 5] }
    ])('refuses $name as a selector and registers nothing', ({ selector }) => {
      const apply = vi.fn()

      expectRefusal(
        () => Reflect.apply(defs.extend, defs, [packId, selector, apply]),
        'extend'
      )
      registerHost('Pick', 'a')

      expect(apply).not.toHaveBeenCalled()
      expect(typesExtended('Pick').types).toEqual(['Pick'])
    })

    it('refuses an apply that is not a function and registers nothing', () => {
      registerHost('Pick')

      expectRefusal(
        () =>
          Reflect.apply(defs.extend, defs, [packId, 'Pick', 'not a function']),
        'extend'
      )
      registerHost('Pick')

      expect(reportError).not.toHaveBeenCalled()
    })

    it('stops applying once unsubscribed, and removes only that registration', () => {
      const apply = vi.fn()
      const stop = defs.extend(packId, 'Pick', apply)
      onTestFinished(defs.extend(packId, 'Pick', apply))

      stop()
      stop()
      registerHost('Pick')

      expect(apply).toHaveBeenCalledOnce()
    })

    it('reports an apply that throws and still runs the others', () => {
      const broken = new Error('apply failed')
      const after = vi.fn()
      onTestFinished(
        defs.extend(packId, 'Pick', () => {
          throw broken
        })
      )
      onTestFinished(defs.extend(packId, 'Pick', after))

      registerHost('Pick')

      expect(after).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        broken,
        expect.objectContaining({ tags: { event: 'extend' } })
      )
    })

    it('applies an extension made inside another apply once to each type', () => {
      const nested = vi.fn()
      registerHost('First')
      onTestFinished(
        defs.extend(packId, 'First', () => {
          onTestFinished(defs.extend(packId, /./, nested))
        })
      )

      registerHost('Second')

      expect(nested.mock.calls.map(([builder]) => builder.def.type)).toEqual([
        'First',
        'Second'
      ])
    })

    it('applies to a type defined inside an apply once', () => {
      const apply = vi.fn()
      registerHost('First')

      onTestFinished(
        defs.extend(packId, /./, (builder) => {
          apply(builder.def.type)
          if (builder.def.type === 'First')
            onTestFinished(defs.define(packId, { type: 'Defined' }))
        })
      )

      expect(apply.mock.calls).toEqual([['First'], ['Defined']])
    })

    it('hands a frozen builder', () => {
      let builder: NodeDefBuilder | undefined
      registerHost('Pick')

      onTestFinished(
        defs.extend(packId, 'Pick', (given) => {
          builder = given
        })
      )

      assert(builder)
      expect(Object.isFrozen(builder)).toBe(true)
      expect(Object.isFrozen(builder.def)).toBe(true)
    })
  })

  describe('reading definitions', () => {
    it('reads what the host declares for a type', () => {
      registerHostType(
        host.nodeTypeHooks,
        hostNodeDef('Sampler', {
          display_name: 'My Sampler',
          category: 'sampling',
          description: 'Samples.',
          output_node: true,
          input: {
            required: {
              seed: ['INT', { default: 0, min: 0 }],
              sampler: [['euler', 'ddim'], { default: 'euler' }]
            },
            optional: {
              scheduler: ['COMBO', { options: ['normal', 1] }],
              model: ['MODEL']
            },
            hidden: { prompt: 'PROMPT' }
          },
          output: ['LATENT', ['a', 'b']],
          output_name: ['samples']
        })
      )

      expect(defs.get('Sampler')).toEqual({
        type: 'Sampler',
        title: 'My Sampler',
        category: 'sampling',
        description: 'Samples.',
        inputs: [
          {
            name: 'seed',
            type: 'INT',
            localizedName: 'seed',
            options: { default: 0, min: 0 }
          },
          {
            name: 'sampler',
            type: 'COMBO',
            localizedName: 'sampler',
            values: ['euler', 'ddim'],
            options: { default: 'euler' }
          },
          {
            name: 'scheduler',
            type: 'COMBO',
            localizedName: 'scheduler',
            values: ['normal', 1],
            options: { options: ['normal', 1] }
          },
          { name: 'model', type: 'MODEL', localizedName: 'model', options: {} }
        ],
        outputs: [
          { name: 'samples', type: 'LATENT' },
          { name: 'COMBO', type: 'COMBO' }
        ],
        hidden: { prompt: 'PROMPT' },
        isOutputNode: true
      })
    })

    it('lists the required inputs before the optional ones, an optional input with a numeric name included', () => {
      registerHostType(
        host.nodeTypeHooks,
        hostNodeDef('Numbered', {
          input: { required: { image: ['IMAGE'] }, optional: { 0: ['INT'] } }
        })
      )

      expect(defs.get('Numbered')?.inputs.map(({ name }) => name)).toEqual([
        'image',
        '0'
      ])
    })

    it('reads a type that declares no outputs, and options it cannot copy as none', () => {
      const circular: Record<string, unknown> = {}
      circular.itself = circular
      const declared = hostNodeDef('Odd', {
        input: { required: { value: ['X', circular] }, hidden: circular }
      })
      Reflect.deleteProperty(declared, 'output')
      registerHostType(host.nodeTypeHooks, declared)

      expect(defs.get('Odd')).toMatchObject({
        inputs: [{ name: 'value', options: {} }],
        outputs: [],
        hidden: {}
      })
    })

    it('names an input by the label the type declares for it', () => {
      registerHostType(
        host.nodeTypeHooks,
        hostNodeDef('Labeled', {
          input: { required: { seed: ['INT', { display_name: 'Seed value' }] } }
        })
      )

      expect(defs.get('Labeled')?.inputs[0].localizedName).toBe('Seed value')
    })

    it('titles a type with no display name by its name', () => {
      registerHostType(
        host.nodeTypeHooks,
        hostNodeDef('Untitled', { display_name: '' })
      )

      expect(defs.get('Untitled')?.title).toBe('Untitled')
    })

    it('gives a frozen copy that cannot change the host definition', () => {
      const declared = { default: { nested: [1] } }
      registerHostType(
        host.nodeTypeHooks,
        hostNodeDef('Copied', {
          input: { required: { value: ['X', declared] } }
        })
      )

      const def = defs.get('Copied')
      const options = def?.inputs[0].options

      expect(options).toEqual(declared)
      expect(options).not.toBe(declared)
      expect(Object.isFrozen(def?.inputs)).toBe(true)
      expect(Object.isFrozen(def?.outputs)).toBe(true)
      expect(Object.isFrozen(def?.hidden)).toBe(true)
      expect(Object.isFrozen(Reflect.get(Object(options), 'default'))).toBe(
        true
      )
      expect(defs.get('Copied')).not.toBe(def)
    })

    it('says which types it knows', () => {
      registerHost('Known')

      expect(defs.has('Known')).toBe(true)
      expect(defs.has('Unknown')).toBe(false)
      expect(defs.get('Unknown')).toBeUndefined()
      expect(defs.has('__proto__')).toBe(false)
    })

    it('lists every type in the order it first registered', () => {
      registerHost('First')
      onTestFinished(defs.define(packId, { type: 'Defined' }))
      registerHost('Second')
      registerHost('First')

      const all = defs.all()

      expect(all.map((def) => def.type)).toEqual(['First', 'Defined', 'Second'])
      expect(Object.isFrozen(all)).toBe(true)
    })

    it.for([
      { name: 'a number', type: 5 },
      { name: 'undefined', type: undefined },
      { name: 'null', type: null },
      { name: 'an object', type: {} }
    ])('refuses $name as a type name', ({ type }) => {
      expectRefusal(() => Reflect.apply(defs.get, defs, [type]), 'get')
      expectRefusal(() => Reflect.apply(defs.has, defs, [type]), 'has')
    })
  })

  describe('define', () => {
    it('registers a node type with the slots and title it declares', () => {
      onTestFinished(
        defs.define(packId, {
          type: 'Pack/Switch',
          title: 'Switch',
          category: 'utils',
          description: 'Picks one input.',
          inputs: [{ name: 'a', type: '*' }],
          outputs: [{ name: 'out', type: 'STRING' }]
        })
      )

      const node = LiteGraph.createNode('Pack/Switch')

      assert(node)
      expect(node.title).toBe('Switch')
      expect(node.inputs.map(({ name, type }) => [name, type])).toEqual([
        ['a', '*']
      ])
      expect(node.outputs.map(({ name, type }) => [name, type])).toEqual([
        ['out', 'STRING']
      ])
      expect(LiteGraph.registered_node_types['Pack/Switch'].category).toBe(
        'utils'
      )
      expect(defs.get('Pack/Switch')).toEqual({
        type: 'Pack/Switch',
        title: 'Switch',
        category: 'utils',
        description: 'Picks one input.',
        inputs: [{ name: 'a', type: '*', localizedName: 'a', options: {} }],
        outputs: [{ name: 'out', type: 'STRING' }],
        hidden: {},
        isOutputNode: false
      })
    })

    it('fills in what a definition leaves out', () => {
      onTestFinished(defs.define(packId, { type: 'Bare' }))

      const node = LiteGraph.createNode('Bare')

      expect(node?.title).toBe('Bare')
      expect(node?.isVirtualNode).toBe(true)
      expect(defs.get('Bare')).toMatchObject({
        title: 'Bare',
        category: '',
        description: '',
        inputs: [],
        outputs: []
      })
    })

    it('keeps a frontend node frontend when an extension of it is disposed', () => {
      onTestFinished(
        defs.define(packId, { type: 'Frontend', execution: 'frontend' })
      )
      const stop = defs.extend(packId, 'Frontend', () => {})

      stop()

      expect(LiteGraph.createNode('Frontend')?.isVirtualNode).toBe(true)
    })

    it.for([
      { name: 'a definition that is not an object', definition: 'Pack/Node' },
      { name: 'a missing type', definition: {} },
      { name: 'an empty type', definition: { type: '' } },
      {
        name: 'a type that is a built-in name',
        definition: { type: '__proto__' }
      },
      {
        name: 'an unknown field',
        definition: { type: 'T', supply: () => {} }
      },
      {
        name: 'a resolve that is not a function',
        definition: { type: 'T', execution: 'frontend', resolve: {} }
      },
      {
        name: 'a resolve on a backend type',
        definition: { type: 'T', execution: 'backend', resolve: () => ({}) }
      },
      { name: 'a title that is not text', definition: { type: 'T', title: 5 } },
      {
        name: 'a category that is not text',
        definition: { type: 'T', category: {} }
      },
      {
        name: 'a description that is not text',
        definition: { type: 'T', description: null }
      },
      {
        name: 'inputs that are not a list',
        definition: { type: 'T', inputs: {} }
      },
      {
        name: 'an output without a type',
        definition: { type: 'T', outputs: [{ name: 'o' }] }
      },
      {
        name: 'a slot with more than a name and type',
        definition: { type: 'T', inputs: [{ name: 'i', type: '*', shape: 1 }] }
      },
      {
        name: 'a slot that is not an object',
        definition: { type: 'T', inputs: ['i'] }
      },
      {
        name: 'a type name that is only spaces',
        definition: { type: '  ' }
      },
      {
        name: 'a slot type that is a built-in name, which no node could be made with',
        definition: { type: 'T', inputs: [{ name: 'i', type: 'toString' }] }
      },
      {
        name: 'an input with a shape, which only outputs take',
        definition: {
          type: 'T',
          inputs: [{ name: 'i', type: '*', shape: 'list' }]
        }
      },
      {
        name: 'an output shape the host has no name for',
        definition: {
          type: 'T',
          outputs: [{ name: 'o', type: '*', shape: 'star' }]
        }
      },
      {
        name: 'an output shape given as the host’s number',
        definition: { type: 'T', outputs: [{ name: 'o', type: '*', shape: 7 }] }
      },
      {
        name: 'an output shape that is null',
        definition: {
          type: 'T',
          outputs: [{ name: 'o', type: '*', shape: null }]
        }
      },
      {
        name: 'an unknown execution',
        definition: { type: 'T', execution: 'worker' }
      }
    ])('refuses $name and registers nothing', ({ definition }) => {
      const before = Object.keys(LiteGraph.registered_node_types)

      expectRefusal(
        () => Reflect.apply(defs.define, defs, [packId, definition]),
        'define'
      )
      expect(Object.keys(LiteGraph.registered_node_types)).toEqual(before)
      expect(defs.all()).toEqual([])
    })

    it('names the shapes an output may take when it refuses one', () => {
      expect(() =>
        Reflect.apply(defs.define, defs, [
          packId,
          { type: 'T', outputs: [{ name: 'o', type: '*', shape: 'star' }] }
        ])
      ).toThrow(
        /^define needs outputs\[0\].shape of default, optional, list, directional, not 'star'/
      )
    })

    it('refuses a type that is registered already, and leaves it as it was', () => {
      const existing = registerHost('Taken')

      expectRefusal(() => defs.define(packId, { type: 'Taken' }), 'define')
      expect(LiteGraph.registered_node_types.Taken).toBe(existing)
    })

    it('unregisters the type when unsubscribed, once', () => {
      const stop = defs.define(packId, { type: 'Gone' })

      stop()
      stop()

      expect(LiteGraph.createNode('Gone')).toBeNull()
      expect(defs.has('Gone')).toBe(false)
      expect(() => defs.define(packId, { type: 'Gone' })).not.toThrow()
      expect(defs.has('Gone')).toBe(true)
    })

    it('leaves a type the host registered since alone when unsubscribed', () => {
      const stop = defs.define(packId, { type: 'Shared' })
      const hostClass = registerHost('Shared')

      stop()

      expect(LiteGraph.registered_node_types.Shared).toBe(hostClass)
      expect(defs.has('Shared')).toBe(true)
    })

    it('keeps applying an extension to the type when it is defined again', () => {
      const { types } = typesExtended('Again')
      defs.define(packId, { type: 'Again' })()

      onTestFinished(defs.define(packId, { type: 'Again' }))

      expect(types).toEqual(['Again', 'Again'])
    })
  })

  describe('refresh', () => {
    it.for([true, false])(
      'answers %s as the host does when it reloads the definitions',
      async (applied) => {
        const reload = vi
          .spyOn(app, 'reloadNodeDefs')
          .mockResolvedValue(applied)

        await expect(defs.refresh()).resolves.toBe(applied)
        expect(reload).toHaveBeenCalledExactlyOnceWith()
      }
    )

    it('tells listeners each time the host reloads the definitions', () => {
      const listener = vi.fn()
      const control = vi.fn()
      const stop = defs.onRefreshed(listener)
      defs.onRefreshed(control)

      host.nodeTypeHooks.refreshComboInNodes()
      host.nodeTypeHooks.refreshComboInNodes()
      stop()
      stop()
      host.nodeTypeHooks.refreshComboInNodes()

      expect(listener).toHaveBeenCalledTimes(2)
      expect(control).toHaveBeenCalledTimes(3)
    })

    it('reports a listener that throws and still tells the others', () => {
      const broken = new Error('listener failed')
      const after = vi.fn()
      defs.onRefreshed(() => {
        throw broken
      })
      defs.onRefreshed(after)

      host.nodeTypeHooks.refreshComboInNodes()

      expect(after).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledWith(
        broken,
        expect.objectContaining({ tags: { event: 'onRefreshed' } })
      )
    })

    it.for([undefined, 'listener', {}])(
      'refuses %j as a listener',
      (listener) => {
        expectRefusal(
          () => Reflect.apply(defs.onRefreshed, defs, [listener]),
          'onRefreshed'
        )
      }
    )
  })

  it('cannot be changed by a pack', () => {
    expect(Object.isFrozen(defs)).toBe(true)
  })

  it('titles a type defined with an empty title by its name, as its nodes show it', () => {
    const stop = defs.define(packId, { type: 'Pack/EmptyTitle', title: '' })
    const node = LiteGraph.createNode('Pack/EmptyTitle')
    const title = defs.get('Pack/EmptyTitle')?.title
    stop()

    expect([node?.title, title]).toEqual(['Pack/EmptyTitle', 'Pack/EmptyTitle'])
  })
})
