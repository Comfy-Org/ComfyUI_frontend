import { reportError } from '@comfyorg/telemetry/reportError'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { BaseWidget } from '@/lib/litegraph/src/widgets/BaseWidget'
import { graphToPrompt } from '@/utils/executionUtil'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, WidgetSerializeEvent } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

describe('widget listeners', () => {
  let graph: LGraph
  let comfy: Comfy
  let loading: boolean

  beforeEach(() => {
    graph = new LGraph()
    loading = false
    ;({ comfy } = createComfyApi({
      getGraph: () => graph,
      isLoading: () => loading
    }))
  })

  function nodeWithSeed() {
    const node = new LGraphNode('Node', 'TestNode')
    node.comfyClass = 'TestNode'
    graph.add(node)
    const legacyCallback = vi.fn()
    node.addWidget('number', 'seed', 1, legacyCallback, {})
    node.addWidget('number', 'steps', 20, () => {}, {})
    const [seedWidget] = node.widgets ?? []
    const widgets = comfy.graph.node(String(node.id))?.widgets
    const seed = widgets?.get('seed')
    const steps = widgets?.get('steps')
    assert(seedWidget instanceof BaseWidget && seed && steps)
    return { node, seedWidget, seed, steps, legacyCallback }
  }

  describe('change', () => {
    it('hears a value set through the API, with the value before it', () => {
      const { seed } = nodeWithSeed()
      const listener = vi.fn()
      seed.on('change', listener)

      seed.setValue(5)

      expect(listener).toHaveBeenCalledExactlyOnceWith(5, 1)
    })

    it('hears a user’s edit on the canvas and on the Vue canvas', () => {
      const { node, seedWidget, seed } = nodeWithSeed()
      const listener = vi.fn()
      seed.on('change', listener)

      seedWidget.setValue(5, { node })
      seedWidget.value = 6
      seedWidget.callback?.(6)

      expect(listener.mock.calls).toEqual([
        [5, 1],
        [6, 5]
      ])
    })

    it('runs after the widget’s own callback, which still runs', () => {
      const { seed, legacyCallback } = nodeWithSeed()
      const order: string[] = []
      legacyCallback.mockImplementation(() => order.push('callback'))
      seed.on('change', () => order.push('listener'))

      seed.setValue(5)

      expect(order).toEqual(['callback', 'listener'])
    })

    it('stays quiet for a commit that leaves the value as it was', () => {
      const { seedWidget, seed } = nodeWithSeed()
      const listener = vi.fn()
      seed.on('change', listener)

      seedWidget.callback?.(1)

      expect(listener).not.toHaveBeenCalled()
    })

    it('gives frozen copies of an object value', () => {
      const node = new LGraphNode('Node', 'TestNode')
      graph.add(node)
      node.addWidget('custom', 'data', { list: [1] }, () => {}, {})
      const data = comfy.graph.node(String(node.id))?.widgets.get('data')
      const received: unknown[] = []
      data?.on('change', (value, previous) => received.push(value, previous))

      data?.setValue({ list: [2] })

      expect(received).toEqual([{ list: [2] }, { list: [1] }])
      expect(received.every((value) => Object.isFrozen(value))).toBe(true)
      expect(received[0]).not.toBe(node.widgets?.[0]?.value)
    })

    it('lets the host finish a commit when one listener throws, and tells the others', () => {
      const { node, seedWidget, seed } = nodeWithSeed()
      const failure = new Error('pack listener failed')
      const onWidgetChanged = vi.fn()
      node.onWidgetChanged = onWidgetChanged
      const second = vi.fn()
      seed.on('change', () => {
        throw failure
      })
      seed.on('change', second)
      const version = graph._version

      expect(() => seed.setValue(5)).not.toThrow()

      expect(second).toHaveBeenCalledExactlyOnceWith(5, 1)
      expect(seedWidget.value).toBe(5)
      expect(onWidgetChanged).toHaveBeenCalledOnce()
      expect(graph._version).toBeGreaterThan(version)
      expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
        errorType: 'node_api_listener_failure',
        surface: 'platform',
        tags: { event: 'widget.change' }
      })
    })
  })

  describe('activate', () => {
    it('hears a user’s commit and a button click, not a value set through the API', () => {
      const { node, seedWidget, seed } = nodeWithSeed()
      const listener = vi.fn()
      seed.on('activate', listener)

      seed.setValue(5)
      seedWidget.setValue(6, { node })
      seedWidget.callback?.(undefined)

      expect(listener.mock.calls).toEqual([[6], [6]])
    })

    it('does not report a commit a listener makes through the API while a user’s commit is delivered', () => {
      const { node, seedWidget, seed, steps } = nodeWithSeed()
      const stepsActivated = vi.fn()
      const stepsChanged = vi.fn()
      steps.on('activate', stepsActivated)
      steps.on('change', stepsChanged)
      seed.on('activate', (value) => steps.setValue(Number(value) * 10))

      seedWidget.setValue(3, { node })

      expect(stepsChanged).toHaveBeenCalledExactlyOnceWith(30, 20)
      expect(stepsActivated).not.toHaveBeenCalled()
    })
  })

  describe('while the host loads a graph', () => {
    it('reports no change or activation, and compares the next commit with the value the load left', () => {
      const { node, seedWidget, seed } = nodeWithSeed()
      const heard = vi.fn()
      seed.on('change', (to, from) => heard('change', to, from))
      seed.on('activate', (value) => heard('activate', value))

      loading = true
      seedWidget.setValue(7, { node })
      loading = false

      expect(heard).not.toHaveBeenCalled()

      seedWidget.setValue(8, { node })

      expect(heard.mock.calls).toEqual([
        ['change', 8, 7],
        ['activate', 8]
      ])
    })
  })

  it('reads a widget with no value as null', () => {
    const { seedWidget, seed } = nodeWithSeed()
    const listener = vi.fn()
    seed.on('activate', listener)
    seedWidget.value = undefined

    seedWidget.callback?.(undefined)

    expect(listener).toHaveBeenCalledExactlyOnceWith(null)
  })

  describe('registration', () => {
    it('removes only the registration a disposer came from, however often it is called', () => {
      const { seed } = nodeWithSeed()
      const listener = vi.fn()
      const stopFirst = seed.on('change', listener)
      seed.on('change', listener)

      stopFirst()
      stopFirst()
      seed.setValue(5)

      expect(listener).toHaveBeenCalledOnce()
    })

    it('keeps a listener added during a delivery for the next one', () => {
      const { seed } = nodeWithSeed()
      const added = vi.fn()
      seed.on('change', () => {
        seed.on('change', added)
      })

      seed.setValue(5)

      expect(added).not.toHaveBeenCalled()

      seed.setValue(6)

      expect(added).toHaveBeenCalledOnce()
    })

    it('wraps the widget’s callback once, however many listeners a pack adds', () => {
      const { seedWidget, seed, legacyCallback } = nodeWithSeed()
      seed.on('change', () => {})
      const wrapped = seedWidget.callback
      seed.on('activate', () => {})
      seed.on('change', () => {})

      seed.setValue(5)

      expect(seedWidget.callback).toBe(wrapped)
      expect(legacyCallback).toHaveBeenCalledOnce()
    })

    it('leaves the listeners of a removed widget behind when one is added under its name', () => {
      const { node, seedWidget, seed } = nodeWithSeed()
      const listener = vi.fn()
      seed.on('change', listener)

      node.removeWidget(seedWidget)
      node.addWidget('number', 'seed', 1, () => {}, {})
      seed.setValue(5)

      expect(seed.getValue()).toBe(5)
      expect(listener).not.toHaveBeenCalled()
    })

    it.for([['input'], ['changed'], [undefined], [1]])(
      'refuses an event it does not have: %o',
      ([event]) => {
        const { seed } = nodeWithSeed()

        expect(() => Reflect.apply(seed.on, seed, [event, () => {}])).toThrow(
          'on needs an event of change, activate, removed, beforeSerialize'
        )
      }
    )

    it('refuses a listener that is not a function', () => {
      const { seed } = nodeWithSeed()

      expect(() => Reflect.apply(seed.on, seed, ['change', 'f'])).toThrow(
        'on needs a function to call'
      )
    })

    it('registers nothing on a deleted widget, and still refuses what it cannot use', () => {
      const { node, seedWidget, seed } = nodeWithSeed()
      const callback = seedWidget.callback
      node.removeWidget(seedWidget)

      const stop = seed.on('change', vi.fn())

      expect(seedWidget.callback).toBe(callback)
      expect(stop).not.toThrow()
      expectRefusal(() => Reflect.apply(seed.on, seed, ['change', 1]), 'on')
    })
  })

  describe('removed', () => {
    it('runs once however often the host releases the widget', () => {
      const { seedWidget, seed } = nodeWithSeed()
      const listener = vi.fn()
      seed.on('removed', listener)

      seedWidget.onRemove?.()
      seedWidget.onRemove?.()

      expect(listener).toHaveBeenCalledOnce()
    })

    it('runs once when the widget is removed', () => {
      const { seed } = nodeWithSeed()
      const listener = vi.fn()
      seed.on('removed', listener)

      comfy.graph.nodes()[0]?.widgets.remove('seed')

      expect(listener).toHaveBeenCalledOnce()
    })

    it('lets the removal finish when a listener throws', () => {
      const { node, seedWidget, seed } = nodeWithSeed()
      const after = vi.fn()
      seed.on('removed', () => {
        throw new Error('pack cleanup failed')
      })
      seed.on('removed', after)

      node.removeWidget(seedWidget)

      expect(node.widgets?.map(({ name }) => name)).toEqual(['steps'])
      expect(after).toHaveBeenCalledOnce()
      expect(reportError).toHaveBeenCalledOnce()
    })

    it('keeps the widget’s own removal hook', () => {
      const { node, seedWidget, seed } = nodeWithSeed()
      const onRemove = vi.fn()
      seedWidget.onRemove = onRemove
      seed.on('removed', () => {})

      node.removeWidget(seedWidget)

      expect(onRemove).toHaveBeenCalledOnce()
    })
  })

  describe('beforeSerialize', () => {
    async function promptInputs() {
      const { output } = await graphToPrompt(graph)
      return Object.values(output)[0]?.inputs
    }

    it('sends the value a listener supplies in the queued prompt, and leaves the widget as it was', async () => {
      const { seedWidget, seed } = nodeWithSeed()
      const events: WidgetSerializeEvent[] = []
      seed.on('beforeSerialize', (event) => {
        events.push(event)
        event.setSerializedValue(99)
      })

      expect(await promptInputs()).toMatchObject({ seed: 99, steps: 20 })
      expect(seedWidget.value).toBe(1)
      expect(events[0]).toMatchObject({ context: 'prompt', value: 1 })
      expect(Object.isFrozen(events[0])).toBe(true)
    })

    it('sends the widget’s value when no listener replaces it', async () => {
      const { seed } = nodeWithSeed()
      const stop = seed.on('beforeSerialize', (event) =>
        event.setSerializedValue(99)
      )
      seed.on('beforeSerialize', () => {})

      stop()

      expect(await promptInputs()).toMatchObject({ seed: 1 })
    })

    it('passes the value through once every listener is gone', async () => {
      const { seedWidget, seed } = nodeWithSeed()
      const stop = seed.on('beforeSerialize', (event) =>
        event.setSerializedValue(99)
      )
      stop()

      expect(seedWidget.serializeValue).toBeDefined()
      expect(await promptInputs()).toMatchObject({ seed: 1 })
    })

    it('sends the last value listeners supply', async () => {
      const { seed } = nodeWithSeed()
      seed.on('beforeSerialize', (event) => event.setSerializedValue(2))
      seed.on('beforeSerialize', (event) => event.setSerializedValue(3))

      expect(await promptInputs()).toMatchObject({ seed: 3 })
    })

    it('starts from what an earlier serializer of the widget sends', async () => {
      const { seedWidget, seed } = nodeWithSeed()
      seedWidget.serializeValue = async () => 40
      const seen: unknown[] = []
      seed.on('beforeSerialize', (event) => seen.push(event.value))

      expect(await promptInputs()).toMatchObject({ seed: 40 })
      expect(seen).toEqual([40])
    })

    it('refuses a value the workflow cannot save, and sends the widget’s own', async () => {
      const { seed } = nodeWithSeed()
      seed.on('beforeSerialize', (event) =>
        Reflect.apply(event.setSerializedValue, event, [() => 1])
      )

      expect(await promptInputs()).toMatchObject({ seed: 1 })
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TypeError' }),
        expect.objectContaining({ tags: { event: 'widget.beforeSerialize' } })
      )
    })

    it('ignores a replacement made after the listener returned', async () => {
      const { seed } = nodeWithSeed()
      let late: WidgetSerializeEvent | undefined
      seed.on('beforeSerialize', (event) => {
        late = event
      })

      await promptInputs()
      late?.setSerializedValue(7)

      expect(await promptInputs()).toMatchObject({ seed: 1 })
    })
  })
})
