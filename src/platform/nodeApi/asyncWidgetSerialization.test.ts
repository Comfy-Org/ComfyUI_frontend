import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { graphToPrompt } from '@/utils/executionUtil'

import { serializeWorkflow } from './asyncWidgetSerialization'
import type {
  AsyncWidgetSerializer,
  WidgetSerializationProjection
} from './asyncWidgetSerialization'
import {
  createWidgetHandles,
  subscribeAsyncWidgetSerialization
} from './widgetHandle'

function fixture(value: string | object = 'live') {
  const graph = new LGraph()
  const node = new LGraphNode('Test', 'Test')
  node.comfyClass = 'Test'
  node.serialize_widgets = true
  graph.add(node)
  const widget = node.addWidget('custom', 'tags', value, () => undefined, {})
  widget.value = value
  const handle = createWidgetHandles(() => graph).handleFor(
    String(node.id),
    'tags'
  )
  return { graph, node, widget, handle }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

describe('asynchronous widget serialization', () => {
  it('rejects the first async subscription installed after queue capture', async () => {
    const { graph, node, widget, handle } = fixture()
    const queued = graphToPrompt(graph)
    const stop = subscribeAsyncWidgetSerialization(
      handle,
      async ({ context, value }) => ({
        changed: true,
        value: `${context}:${value}`
      })
    )

    try {
      await expect(queued).rejects.toThrow(/changed during.*serialization/)
      const retry = await graphToPrompt(graph)
      expect(retry.workflow.nodes[0].widgets_values).toEqual(['embedded:live'])
      expect(retry.output[String(node.id)].inputs.tags).toBe('prompt:live')
      expect(widget.value).toBe('live')
    } finally {
      stop()
    }
  })

  it('rejects the first async subscription while a native prompt serializer awaits', async () => {
    const { graph, node, widget } = fixture('first')
    const later = node.addWidget('text', 'later', 'old', null, {})
    const laterHandle = createWidgetHandles(() => graph).handleFor(
      String(node.id),
      'later'
    )
    const started = deferred()
    const release = deferred()
    widget.serializeValue = async () => {
      started.resolve()
      await release.promise
      return 'native-first'
    }

    const queued = graphToPrompt(graph)
    await started.promise
    const stop = subscribeAsyncWidgetSerialization(
      laterHandle,
      async ({ value }) => ({ changed: true, value: `projected:${value}` })
    )
    try {
      release.resolve()
      await expect(queued).rejects.toThrow(/changed during.*serialization/)
      expect(widget.value).toBe('first')
      expect(later.value).toBe('old')
    } finally {
      release.resolve()
      stop()
    }
  })

  it('rejects a first subscription on a queued node moved to another graph', async () => {
    const { graph, node, widget } = fixture('first')
    const later = node.addWidget('text', 'later', 'old', null, {})
    const started = deferred()
    const release = deferred()
    widget.serializeValue = async () => {
      started.resolve()
      await release.promise
      return 'native-first'
    }

    const queued = graphToPrompt(graph)
    await started.promise
    graph.remove(node)
    const destination = new LGraph()
    destination.add(node)
    const handle = createWidgetHandles(() => destination).handleFor(
      String(node.id),
      'later'
    )
    const stop = subscribeAsyncWidgetSerialization(
      handle,
      async ({ context, value }) => ({
        changed: true,
        value: `${context}:${value}`
      })
    )
    try {
      release.resolve()
      await expect(queued).rejects.toThrow(/changed during.*serialization/)
      const retry = await graphToPrompt(destination)
      expect(retry.workflow.nodes[0].widgets_values).toEqual([
        'first',
        'embedded:old'
      ])
      expect(retry.output[String(node.id)].inputs.later).toBe('prompt:old')
      expect(later.value).toBe('old')
    } finally {
      release.resolve()
      stop()
    }
  })

  it('rejects the first async subscription in a nested graph after queue capture', async () => {
    const { graph } = fixture('root')
    const subgraph = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(subgraph.id, subgraph)
    graph.add(createTestSubgraphNode(subgraph, { parentGraph: graph }))
    const inner = new LGraphNode('Inner', 'Test')
    inner.comfyClass = 'Test'
    inner.serialize_widgets = true
    subgraph.add(inner)
    inner.addWidget('text', 'later', 'old', null, {})
    const innerHandle = createWidgetHandles(() => subgraph).handleFor(
      String(inner.id),
      'later'
    )

    const queued = graphToPrompt(graph)
    const stop = subscribeAsyncWidgetSerialization(
      innerHandle,
      async ({ value }) => ({ changed: true, value: `projected:${value}` })
    )
    try {
      await expect(queued).rejects.toThrow(/changed during.*serialization/)
    } finally {
      stop()
    }
  })

  it.for([
    { scope: 'root', parent: (graph: LGraph) => graph },
    {
      scope: 'empty reachable subgraph',
      parent: (graph: LGraph) => {
        const outer = createTestSubgraph({ rootGraph: graph })
        graph.subgraphs.set(outer.id, outer)
        graph.add(createTestSubgraphNode(outer, { parentGraph: graph }))
        return outer
      }
    }
  ])(
    'rejects a subgraph with an existing serializer attached to $scope after queue capture',
    async ({ parent }) => {
      const { graph } = fixture('root')
      const destination = parent(graph)
      const subgraph = createTestSubgraph({ rootGraph: graph })
      graph.subgraphs.set(subgraph.id, subgraph)
      const instance = createTestSubgraphNode(subgraph, {
        parentGraph: destination
      })
      const inner = new LGraphNode('Inner', 'Test')
      inner.comfyClass = 'Test'
      inner.serialize_widgets = true
      subgraph.add(inner)
      const later = inner.addWidget('text', 'later', 'old', null, {})
      const handle = createWidgetHandles(() => subgraph).handleFor(
        String(inner.id),
        'later'
      )
      const stop = subscribeAsyncWidgetSerialization(
        handle,
        async ({ context, value }) => ({
          changed: true,
          value: `${context}:${value}`
        })
      )

      try {
        const queued = graphToPrompt(graph)
        destination.add(instance)
        await expect(queued).rejects.toThrow(/changed during.*serialization/)
        const retry = await graphToPrompt(graph)
        expect(
          Object.values(retry.output).map((node) => node.inputs.later)
        ).toContain('prompt:old')
        expect(later.value).toBe('old')
      } finally {
        stop()
      }
    }
  )

  it('rejects a pre-subscribed subgraph attached inside a version batch during queue capture', async () => {
    const { graph } = fixture('root')
    const subgraph = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(subgraph.id, subgraph)
    const instance = createTestSubgraphNode(subgraph, { parentGraph: graph })
    const inner = new LGraphNode('Inner', 'Test')
    inner.comfyClass = 'Test'
    inner.serialize_widgets = true
    subgraph.add(inner)
    inner.addWidget('text', 'later', 'old', null, {})
    const handle = createWidgetHandles(() => subgraph).handleFor(
      String(inner.id),
      'later'
    )
    const stop = subscribeAsyncWidgetSerialization(
      handle,
      async ({ value }) => ({
        changed: true,
        value: `projected:${value}`
      })
    )
    const earlier = new LGraphNode('Earlier', 'Test')
    earlier.comfyClass = 'Test'
    try {
      const queued = graph.batchVersionUpdates(() => {
        graph.add(earlier)
        const pending = graphToPrompt(graph)
        graph.add(instance)
        return pending
      })
      await expect(queued).rejects.toThrow(/changed during.*serialization/)
    } finally {
      stop()
    }
  })

  it('allows a first async subscription in an unrelated graph during queue capture', async () => {
    const { graph, node } = fixture()
    const other = fixture('other')
    const queued = graphToPrompt(graph)
    const stop = subscribeAsyncWidgetSerialization(
      other.handle,
      async ({ value }) => ({ changed: true, value: `projected:${value}` })
    )
    try {
      const result = await queued
      expect(result.workflow.nodes[0].widgets_values).toEqual(['live'])
      expect(result.output[String(node.id)].inputs.tags).toBe('live')
    } finally {
      stop()
    }
  })

  it('rejects a later widget edit between embedded capture and prompt projection', async () => {
    const { graph, node, handle } = fixture('first')
    const later = node.addWidget('text', 'later', 'old', null, {})
    const laterHandle = createWidgetHandles(() => graph).handleFor(
      String(node.id),
      'later'
    )
    const started = deferred()
    const release = deferred()
    const stopFirst = subscribeAsyncWidgetSerialization(
      handle,
      async ({ context, value }) => {
        if (context === 'prompt') {
          started.resolve()
          await release.promise
        }
        return { changed: true, value: `${context}:${value}` }
      }
    )
    const stopLater = subscribeAsyncWidgetSerialization(
      laterHandle,
      async ({ context, value }) => ({
        changed: true,
        value: `${context}:${value}`
      })
    )

    const queued = graphToPrompt(graph)
    await started.promise
    later.value = 'new'
    release.resolve()
    await expect(queued).rejects.toThrow(/changed during.*serialization/)
    stopFirst()
    stopLater()
    const retry = await graphToPrompt(graph)
    expect(retry.workflow.nodes[0].widgets_values).toEqual(['first', 'new'])
    expect(retry.output[String(node.id)].inputs.later).toBe('new')
  })

  it('rejects a later widget edit before its workflow projection starts', async () => {
    const { graph, node, handle } = fixture('first')
    const later = node.addWidget('text', 'later', 'old', null, {})
    const laterHandle = createWidgetHandles(() => graph).handleFor(
      String(node.id),
      'later'
    )
    const started = deferred()
    const release = deferred()
    subscribeAsyncWidgetSerialization(handle, async () => {
      started.resolve()
      await release.promise
      return { changed: false }
    })
    subscribeAsyncWidgetSerialization(laterHandle, async ({ value }) => ({
      changed: true,
      value
    }))

    const saved = serializeWorkflow(graph)
    await started.promise
    later.value = 'new'
    release.resolve()
    await expect(saved).rejects.toThrow(/changed during.*serialization/)
  })

  it.for(['value', 'widget', 'node', 'subscription', 'inclusion'] as const)(
    'rejects a %s change while another widget is projecting the prompt',
    async (change) => {
      const { graph, node, handle } = fixture('first')
      const later = node.addWidget('text', 'later', 'old', null, {})
      const started = deferred()
      const release = deferred()
      subscribeAsyncWidgetSerialization(handle, async ({ context }) => {
        if (context === 'prompt') {
          started.resolve()
          await release.promise
        }
        return { changed: false }
      })

      const queued = graphToPrompt(graph)
      await started.promise
      const mutate = {
        value: () => {
          later.value = 'new'
        },
        widget: () => {
          node.removeWidget(later)
          node.addWidget('text', 'later', 'old', null, {})
        },
        node: () => {
          graph.add(new LGraphNode('Added', 'Added'))
        },
        subscription: () => {
          const laterHandle = createWidgetHandles(() => graph).handleFor(
            String(node.id),
            'later'
          )
          subscribeAsyncWidgetSerialization(laterHandle, async () => ({
            changed: false
          }))
        },
        inclusion: () => {
          later.options.serialize = false
        }
      }
      mutate[change]()
      release.resolve()
      await expect(queued).rejects.toThrow(/changed during.*serialization/)
    }
  )

  it('includes nested graph widgets in the queue capture', async () => {
    const { graph, handle } = fixture('root')
    const subgraph = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(subgraph.id, subgraph)
    graph.add(createTestSubgraphNode(subgraph, { parentGraph: graph }))
    const inner = new LGraphNode('Inner', 'Test')
    inner.comfyClass = 'Test'
    inner.serialize_widgets = true
    subgraph.add(inner)
    const later = inner.addWidget('text', 'later', 'old', null, {})
    const started = deferred()
    const release = deferred()
    subscribeAsyncWidgetSerialization(handle, async ({ context }) => {
      if (context === 'prompt') {
        started.resolve()
        await release.promise
      }
      return { changed: false }
    })

    const queued = graphToPrompt(graph)
    await started.promise
    later.value = 'new'
    release.resolve()
    await expect(queued).rejects.toThrow(/changed during.*serialization/)
  })

  it('awaits separate embedded and prompt projections without changing live data', async () => {
    const { graph, node, widget, handle } = fixture()
    subscribeAsyncWidgetSerialization(handle, async ({ context, value }) => {
      await Promise.resolve()
      return { changed: true, value: `${context}:${value}` }
    })

    const result = await graphToPrompt(graph)
    expect(result.workflow.nodes[0].widgets_values).toEqual(['embedded:live'])
    expect(result.output[String(node.id)].inputs.tags).toBe('prompt:live')
    expect(widget.value).toBe('live')
  })

  it('writes the current workflow projection only for this save', async () => {
    const { graph, widget, handle } = fixture()
    const project = vi.fn<AsyncWidgetSerializer>(
      async ({ context, value }) => ({
        changed: true,
        value: `${context}:${value}`
      })
    )
    subscribeAsyncWidgetSerialization(handle, project)

    expect(graph.serialize().nodes[0].widgets_values).toEqual(['live'])
    expect(project).not.toHaveBeenCalled()
    expect((await serializeWorkflow(graph)).nodes[0].widgets_values).toEqual([
      'workflow:live'
    ])
    widget.value = 'edited'
    expect((await serializeWorkflow(graph)).nodes[0].widgets_values).toEqual([
      'workflow:edited'
    ])
    expect(graph.serialize().nodes[0].widgets_values).toEqual(['edited'])
  })

  it('composes an existing prompt serializer with the worker projection', async () => {
    const { graph, node, widget, handle } = fixture()
    widget.serializeValue = async () => 'native'
    subscribeAsyncWidgetSerialization(handle, async ({ value }) => ({
      changed: true,
      value: `${value}:worker`
    }))

    expect(
      (await graphToPrompt(graph)).output[String(node.id)].inputs.tags
    ).toBe('native:worker')
    expect(widget.value).toBe('live')
  })

  it('refuses a stale value returned by an asynchronous native prompt serializer', async () => {
    const { graph, node, widget, handle } = fixture()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    widget.serializeValue = async () => {
      await gate
      return 'native-old'
    }
    const project = vi.fn<AsyncWidgetSerializer>(async () => ({
      changed: false
    }))
    subscribeAsyncWidgetSerialization(handle, project)

    const pending = widget.serializeValue(node, 0)
    widget.value = 'edited'
    release()
    await expect(pending).rejects.toThrow('changed during serialization')
    expect(project).not.toHaveBeenCalled()
    expect(graph.serialize().nodes[0].widgets_values).toEqual(['edited'])
  })

  it('preserves an explicit undefined projection as prompt omission', async () => {
    const { graph, node, handle } = fixture()
    subscribeAsyncWidgetSerialization(handle, async () => ({
      changed: true,
      value: undefined
    }))

    const { output } = await graphToPrompt(graph)
    expect(JSON.parse(JSON.stringify(output[String(node.id)].inputs))).toEqual(
      {}
    )
  })

  it('keeps workflow and prompt inclusion flags independent', async () => {
    const { graph, node, widget, handle } = fixture()
    widget.serialize = false
    const project = vi.fn<AsyncWidgetSerializer>(async ({ context }) => ({
      changed: true,
      value: context
    }))
    subscribeAsyncWidgetSerialization(handle, project)

    const { workflow, output } = await graphToPrompt(graph)
    expect(workflow.nodes[0].widgets_values).toEqual([])
    expect(output[String(node.id)].inputs.tags).toBe('prompt')
    expect(project.mock.calls.map(([event]) => event.context)).toEqual([
      'prompt'
    ])
  })

  it('rejects edits while a worker is preparing a save', async () => {
    const { graph, widget, handle } = fixture()
    let answer!: (value: WidgetSerializationProjection) => void
    subscribeAsyncWidgetSerialization(
      handle,
      () =>
        new Promise((resolve) => {
          answer = resolve
        })
    )
    const saved = serializeWorkflow(graph)
    widget.value = 'changed'
    answer({ changed: true, value: 'obsolete' })

    await expect(saved).rejects.toThrow(/changed during serialization/)
    expect(widget.value).toBe('changed')
    expect(graph.serialize().nodes[0].widgets_values).toEqual(['changed'])
  })

  it('detects in-place data edits and isolates the value supplied to a worker', async () => {
    const live = { tags: ['a'] }
    const { graph, handle } = fixture(live)
    subscribeAsyncWidgetSerialization(handle, async ({ value }) => {
      expect(value).toEqual({ tags: ['a'] })
      live.tags.push('b')
      return { changed: false }
    })

    await expect(serializeWorkflow(graph)).rejects.toThrow(
      /changed during serialization/
    )
    expect(live).toEqual({ tags: ['a', 'b'] })
  })

  it('rejects removed subscriptions during serialization', async () => {
    const { graph, handle } = fixture()
    let answer!: (value: WidgetSerializationProjection) => void
    const stop = subscribeAsyncWidgetSerialization(
      handle,
      () =>
        new Promise((resolve) => {
          answer = resolve
        })
    )
    const saved = serializeWorkflow(graph)
    stop()
    answer({ changed: true, value: 'obsolete' })

    await expect(saved).rejects.toThrow(/changed during serialization/)
    expect((await serializeWorkflow(graph)).nodes[0].widgets_values).toEqual([
      'live'
    ])
  })

  it('rejects a replaced widget even when its name and value match', async () => {
    const { graph, node, widget, handle } = fixture()
    subscribeAsyncWidgetSerialization(handle, async () => {
      node.removeWidget(widget)
      node.addWidget('text', 'tags', 'live', null, {})
      return { changed: true, value: 'obsolete' }
    })

    await expect(serializeWorkflow(graph)).rejects.toThrow(
      /changed during serialization/
    )
    expect(node.widgets?.[0].value).toBe('live')
  })

  it('propagates a worker failure and leaves subsequent saves usable', async () => {
    const { graph, handle } = fixture()
    const stop = subscribeAsyncWidgetSerialization(handle, async () => {
      throw new Error('worker stopped')
    })

    await expect(serializeWorkflow(graph)).rejects.toThrow('worker stopped')
    stop()
    expect((await serializeWorkflow(graph)).nodes[0].widgets_values).toEqual([
      'live'
    ])
  })

  it('keeps concurrent destinations separate', async () => {
    const { graph, handle } = fixture()
    subscribeAsyncWidgetSerialization(handle, async ({ context }) => {
      await Promise.resolve()
      return { changed: true, value: context }
    })

    const [saved, embedded] = await Promise.all([
      serializeWorkflow(graph),
      serializeWorkflow(graph, { context: 'embedded' })
    ])
    expect(saved.nodes[0].widgets_values).toEqual(['workflow'])
    expect(embedded.nodes[0].widgets_values).toEqual(['embedded'])
    expect(graph.serialize().nodes[0].widgets_values).toEqual(['live'])
  })
})
