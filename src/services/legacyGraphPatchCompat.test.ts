import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reportError } from '@comfyorg/telemetry/reportError'

import {
  applyLegacyGraphPatches,
  captureLegacyGraphPatches
} from './legacyGraphPatchCompat'

vi.mock(import('@comfyorg/telemetry/reportError'))

describe('legacy graph patch compatibility', () => {
  it('uses each graph predecessor and keeps later graph-local wrappers local', () => {
    const first = new LGraph()
    const second = new LGraph()
    const host = { rootGraphOrUndefined: first }
    const calls: string[] = []
    first.onNodeAdded = () => void calls.push('first predecessor')
    second.onNodeAdded = () => void calls.push('second predecessor')

    captureLegacyGraphPatches(
      host,
      { name: 'pysssss.WidgetDefaults' },
      'setup',
      () => {
        const previous = first.onNodeAdded
        first.onNodeAdded = function (node) {
          previous?.call(this, node)
          calls.push('defaults')
        }
      }
    )
    const firstHook = first.onNodeAdded
    first.onNodeAdded = function (node) {
      firstHook.call(this, node)
      calls.push('first local')
    }
    applyLegacyGraphPatches(host, second)
    applyLegacyGraphPatches(host, second)

    host.rootGraphOrUndefined = second
    second.onNodeAdded(new LGraphNode('second node'))
    host.rootGraphOrUndefined = first
    first.onNodeAdded(new LGraphNode('first node'))

    expect(calls).toEqual([
      'second predecessor',
      'defaults',
      'first predecessor',
      'defaults',
      'first local'
    ])
  })

  it('keeps an explicit receiver other than the boot graph during dispatch', () => {
    const first = new LGraph()
    const second = new LGraph()
    const third = new LGraph()
    first.add(new LGraphNode('first node'))
    second.add(new LGraphNode('second node'))
    third.add(new LGraphNode('third node'))
    const host = { rootGraphOrUndefined: first }
    const exported: (string | undefined)[][] = []
    captureLegacyGraphPatches(host, { name: 'cross.root' }, 'setup', () => {
      const original = first.serialize
      first.serialize = function (...args) {
        exported.push(
          original.apply(third, args).nodes.map((node) => node.title)
        )
        return original.apply(this, args)
      }
    })
    applyLegacyGraphPatches(host, second)
    applyLegacyGraphPatches(host, third)
    host.rootGraphOrUndefined = second

    const own = second.serialize().nodes.map((node) => node.title)

    expect({ own, exported }).toEqual({
      own: ['second node'],
      exported: [['third node']]
    })
  })

  it('leaves a member saved but not replaced in setup usable on later roots', () => {
    const first = new LGraph()
    const second = new LGraph()
    second.add(new LGraphNode('second node'))
    const host = { rootGraphOrUndefined: first }
    const saved = captureLegacyGraphPatches(
      host,
      { name: 'saves.serialize' },
      'setup',
      () => first.serialize
    )
    host.rootGraphOrUndefined = second

    expect(saved.call(second).nodes.map((node) => node.title)).toEqual([
      'second node'
    ])
  })

  it('bypasses the Manager active-graph clear wrapper on an inactive root', async () => {
    const first = new LGraph()
    const second = new LGraph()
    const host = { rootGraphOrUndefined: first }
    const calls: string[] = []
    first.clear = () => void calls.push('clear first')
    second.clear = () => void calls.push('clear second')

    await captureLegacyGraphPatches(
      host,
      { name: 'Comfy.ManagerMenu' },
      'setup',
      async () => {
        const previous = first.clear
        first.clear = function () {
          previous.call(host.rootGraphOrUndefined)
          calls.push('load components')
        }
        await Promise.resolve()
      }
    )
    applyLegacyGraphPatches(host, second)
    host.rootGraphOrUndefined = second
    first.clear()
    second.clear()

    expect(calls).toEqual(['clear first', 'clear second', 'load components'])
  })

  it('forwards conversion arguments and returns a subgraph in the destination root', () => {
    const first = createTestRootGraph()
    const second = createTestRootGraph()
    const host = { rootGraphOrUndefined: first }
    onTestFinished(enableSubgraphNodeCreation(second))
    const node = createTestNode(second, [], ['number'])
    const converted: LGraph[] = []
    captureLegacyGraphPatches(
      host,
      { name: 'cg.customnodes.use_everywhere' },
      'init',
      () => {
        const previous = first.convertToSubgraph
        first.convertToSubgraph = function (items) {
          converted.push(this)
          return previous.call(this, items)
        }
      }
    )
    applyLegacyGraphPatches(host, second)
    host.rootGraphOrUndefined = second

    const result = second.convertToSubgraph(new Set([node]))

    expect(converted).toEqual([second])
    expect(result.node.graph).toBe(second)
    expect(result.subgraph.nodes).toMatchObject([
      { type: node.type, outputs: [{ type: 'number' }] }
    ])
    expect(first.nodes).toEqual([])
  })

  it('reports one deprecation per extension across hooks and roots', () => {
    const first = new LGraph()
    const host = { rootGraphOrUndefined: first }
    const installManager = () => {
      first.clear = () => {}
    }

    captureLegacyGraphPatches(
      host,
      { name: 'Comfy.ManagerMenu' },
      'setup',
      installManager
    )
    captureLegacyGraphPatches(
      host,
      { name: 'Comfy.ManagerMenu' },
      'setup',
      installManager
    )
    captureLegacyGraphPatches(
      host,
      { name: 'cg.customnodes.use_everywhere' },
      'init',
      () => {
        first.beforeChange = () => {}
        first.afterChange = () => {}
      }
    )
    applyLegacyGraphPatches(host, new LGraph())
    applyLegacyGraphPatches(host, new LGraph())

    expect(reportError).toHaveBeenCalledTimes(2)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Update the extension')
      }),
      expect.objectContaining({
        errorType: 'deprecated_extension_graph_patch',
        surface: 'graph',
        level: 'warning',
        tags: { extension: 'cg.customnodes.use_everywhere' },
        context: { hook: 'init', members: ['beforeChange', 'afterChange'] }
      })
    )
  })

  it('resolves a predecessor bound to the boot graph against the dispatched graph', () => {
    const first = new LGraph()
    const second = new LGraph()
    const host = { rootGraphOrUndefined: first }
    first.add(new LGraphNode('boot node'))

    captureLegacyGraphPatches(host, { name: 'halxp.export' }, 'setup', () => {
      const original = first.serialize.bind(first)
      first.serialize = function (options) {
        const data = original(options)
        data.extra = { ...data.extra, exporter: 'halxp' }
        return data
      }
    })
    applyLegacyGraphPatches(host, second)
    host.rootGraphOrUndefined = second

    expect(second.serialize()).toMatchObject({
      id: second.id,
      nodes: [],
      extra: { exporter: 'halxp' }
    })
    expect(first.serialize().nodes).toHaveLength(1)
  })

  it.for([
    {
      label: 'a load hook',
      extension: { name: 'legacy.extension' },
      hook: 'afterLoadGraph'
    },
    {
      label: 'an extension with beforeConfigureGraph',
      extension: { name: 'legacy.extension', beforeConfigureGraph() {} },
      hook: 'setup'
    },
    {
      label: 'an extension with afterLoadGraph',
      extension: { name: 'legacy.extension', afterLoadGraph() {} },
      hook: 'setup'
    }
  ])('leaves patches from $label outside the bridge', ({ extension, hook }) => {
    const first = new LGraph()
    const second = new LGraph()
    const host = { rootGraphOrUndefined: first }
    const calls: string[] = []
    captureLegacyGraphPatches(host, extension, hook, () => {
      first.onNodeAdded = () => void calls.push('first')
    })
    applyLegacyGraphPatches(host, second)
    host.rootGraphOrUndefined = second
    second.onNodeAdded?.(new LGraphNode('second node'))

    expect(calls).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('restores untouched members without warning or shadowing prototype hooks', () => {
    const graph = new LGraph()
    const host = { rootGraphOrUndefined: graph }
    const before = Object.getOwnPropertyDescriptor(graph, 'clear')

    const result = captureLegacyGraphPatches(
      host,
      { name: 'Comfy.ManagerMenu' },
      'setup',
      () => 'unchanged'
    )

    expect(result).toBe('unchanged')
    expect(Object.getOwnPropertyDescriptor(graph, 'clear')).toEqual(before)
    expect(Object.hasOwn(graph, 'serialize')).toBe(false)
    expect(reportError).not.toHaveBeenCalled()
  })
})
