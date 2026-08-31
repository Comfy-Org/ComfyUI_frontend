import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import {
  LATEST_MAJOR,
  NODE_API_VERSION,
  SUPPORTED_MAJORS,
  createComfyApi
} from './comfyApi'
import { ComfyUnsupportedError } from './errors'

describe('comfy API root', () => {
  let graph: LGraph

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
  })

  const api = () => createComfyApi(() => graph)

  it('reports a version independent of the app version', () => {
    expect(api().version).toBe(NODE_API_VERSION)
    expect(api().version).toMatch(/^\d+\.\d+$/)
    expect(api().major).toBe(LATEST_MAJOR)
    expect(String(api().major)).toBe(NODE_API_VERSION.split('.')[0])
  })

  describe('capability probing', () => {
    it('reports shipped capabilities', () => {
      expect(api().supports('widgets.reorder')).toBe(true)
      expect(api().supports('widgets.hidden')).toBe(true)
      expect(api().supports('widgets.height')).toBe(true)
      expect(api().supports('slots.resolvedSource')).toBe(true)
      expect(api().supports('widgets.linked')).toBe(true)
      expect(api().supports('widgets.textInteraction')).toBe(true)
      expect(api().supports('slots.identity')).toBe(true)
      expect(api().supports('widgets.typeContext')).toBe(true)
      expect(api().supports('workflow.open')).toBe(true)
      expect(api().supports('slots.widgetConfig')).toBe(true)
      expect(api().supports('slots.layout')).toBe(true)
      expect(api().supports('slots.localizedName')).toBe(true)
      expect(api().supports('workflow.textReplacements')).toBe(true)
      expect(api().supports('execution.node')).toBe(true)
      expect(api().supports('defs.typeCompatibility')).toBe(true)
      expect(api().supports('defs.inputValues')).toBe(true)
      expect(api().supports('node.fileDrop')).toBe(true)
      expect(api().supports('queue.disableAutoQueue')).toBe(true)
      expect(api().supports('queue.settings')).toBe(true)
      expect(api().supports('system.monitor')).toBe(true)
    })

    it('returns false for unknown capabilities instead of throwing', () => {
      expect(api().supports('does.not.exist')).toBe(false)
      expect(api().supports('')).toBe(false)
    })

    it('reports slots.named as false until the backend supplies names', () => {
      // While false, '0' resolves positionally — see slotRef.
      expect(api().supports('slots.named')).toBe(false)
    })
  })

  describe('require()', () => {
    it('passes silently for a supported capability', () => {
      expect(() => api().require('widgets.reorder')).not.toThrow()
    })

    it('names the capability and host version when unsupported', () => {
      expect(() => api().require('node.decorations')).toThrow(
        ComfyUnsupportedError
      )
      expect(() => api().require('node.decorations')).toThrow(
        /node\.decorations/
      )
      expect(() => api().require('node.decorations')).toThrow(
        new RegExp(NODE_API_VERSION.replace(/\./g, '\\.'))
      )
    })

    it('says which version a planned capability needs', () => {
      expect(() => api().require('slots.named')).toThrow(
        /'slots\.named' requires \d+\.\d+/
      )
    })

    it('points at supports() so packs can degrade instead of crashing', () => {
      expect(() => api().require('slots.named')).toThrow(/comfy\.supports/)
    })

    it('still fails clearly for an entirely unknown capability', () => {
      expect(() => api().require('made.up')).toThrow(ComfyUnsupportedError)
    })
  })

  describe('capabilities()', () => {
    it('lists what this host provides', () => {
      const caps = api().capabilities()
      expect(caps).toContain('widgets.reorder')
      expect(caps).not.toContain('slots.named')
    })

    it('is frozen', () => {
      expect(Object.isFrozen(api().capabilities())).toBe(true)
    })
  })

  describe('graph access', () => {
    it('reaches the bound graph', () => {
      const node = new LGraphNode('A', 'Alpha')
      graph.add(node)
      expect(api().graph.nodes()).toHaveLength(1)
      expect(api().graph.node(String(node.id))?.type).toBe('Alpha')
    })

    it('follows the graph it is bound to, rather than snapshotting it', () => {
      let current: LGraph | null = null
      const comfy = createComfyApi(() => current)
      expect(comfy.graph.nodes()).toEqual([])

      current = graph
      graph.add(new LGraphNode('A', 'Alpha'))
      expect(comfy.graph.nodes()).toHaveLength(1)
    })

    it('resolves an input through definitions registered on the public API', () => {
      const comfy = api()
      const dispose = comfy.defs.define({
        type: 'ResolvedRelay',
        execution: 'frontend',
        inputs: [{ name: 'in', type: 'IMAGE' }],
        outputs: [{ name: 'out', type: 'IMAGE' }],
        resolve: ({ self }) => ({
          out: { forwardTo: self.input('in')! }
        })
      })

      try {
        const source = new LGraphNode('Source', 'Source')
        source.addOutput('image', 'IMAGE')
        graph.add(source)
        const relay = LiteGraph.createNode('ResolvedRelay')!
        graph.add(relay)
        const target = new LGraphNode('Target', 'Target')
        target.addInput('image', 'IMAGE')
        graph.add(target)
        source.connect(0, relay, 0)
        relay.connect(0, target, 0)

        expect(
          comfy.graph
            .node(String(target.id))!
            .inputs.byName('image')!
            .resolvedSource()
        ).toEqual({
          kind: 'output',
          graphId: String(graph.id),
          nodeId: String(source.id),
          outputIndex: 0
        })
      } finally {
        dispose()
      }
    })
  })

  describe('workflow access', () => {
    it('opens workflow data through the host document service', async () => {
      const openWorkflow = vi.fn(() => Promise.resolve())
      const comfy = createComfyApi(() => graph, LATEST_MAJOR, {
        openWorkflow
      })
      const workflow = { version: 0, nodes: [] }

      await comfy.workflow.open(workflow)

      expect(openWorkflow).toHaveBeenCalledOnce()
      expect(openWorkflow).toHaveBeenCalledWith(workflow)
    })

    it('rejects non-object workflow data before reaching the host', async () => {
      const openWorkflow = vi.fn(() => Promise.resolve())
      const comfy = createComfyApi(() => graph, LATEST_MAJOR, {
        openWorkflow
      })

      await expect(
        Reflect.apply(comfy.workflow.open, comfy.workflow, [null])
      ).rejects.toThrow(/workflow data must be an object/i)
      expect(openWorkflow).not.toHaveBeenCalled()
    })

    it('applies the host text-replacement grammar to the active document', () => {
      const source = new LGraphNode('Source', 'TextSource')
      source.title = 'Prompt source'
      source.addWidget('text', 'text', 'cats/dogs', () => undefined, {})
      graph.add(source)

      expect(api().workflow.applyTextReplacements('%Prompt source.text%')).toBe(
        'cats_dogs'
      )
    })
  })

  describe('execution nodes', () => {
    it('resolves a node inside a subgraph from its backend execution id', () => {
      const subgraph = createTestSubgraph({ rootGraph: graph })
      graph.subgraphs.set(subgraph.id, subgraph)
      const host = createTestSubgraphNode(subgraph, { parentGraph: graph })
      graph.add(host)
      const inner = new LGraphNode('Inner', 'TestNode')
      subgraph.add(inner)

      const found = api().executionNode(
        `${String(host.id)}:${String(inner.id)}`
      )

      expect(found?.id).toBe(String(inner.id))
      expect(found?.graphId).toBe(String(subgraph.id))
    })
  })

  describe('the same node can have two different proxies', () => {
    // Two API instances — or two majors — necessarily mint different proxy
    // objects for one node, because one object cannot have two shapes.
    it('produces non-identical handles across instances', () => {
      const node = new LGraphNode('A', 'Alpha')
      graph.add(node)

      const one = createComfyApi(() => graph)
      const two = createComfyApi(() => graph)
      const a = one.graph.node(String(node.id))!
      const b = two.graph.node(String(node.id))!

      expect(a).not.toBe(b)
      expect(a.id).toBe(b.id)
    })

    it('compares equal via sameEntity', () => {
      const node = new LGraphNode('A', 'Alpha')
      graph.add(node)
      const one = createComfyApi(() => graph)
      const two = createComfyApi(() => graph)

      const a = one.graph.node(String(node.id))!
      const b = two.graph.node(String(node.id))!
      expect(one.sameEntity(a, b)).toBe(true)
      expect(two.sameEntity(a, b)).toBe(true)
    })

    it('mints a different handle for the same node reached through a subgraph', () => {
      // The condition sameEntity's doc names. Reaching a node while its graph
      // is on screen and reaching it through graph.subgraphs() go through
      // different handle caches, so `===` says no and sameEntity says yes.
      // Document-scoped onNodeChanged makes this the ordinary case, not a
      // corner one, which is why the doc calls scope out by name.
      const root = new LGraph()
      const subgraph = createTestSubgraph({ rootGraph: root, name: 'Inner' })
      root.subgraphs.set(subgraph.id, subgraph)
      const node = new LGraphNode('A', 'Alpha')
      subgraph.add(node)

      const comfy = createComfyApi(() => subgraph)
      const visible = comfy.graph.node(String(node.id))!
      const viaDefinition = comfy.graph
        .subgraphs()
        .find(({ id }) => id === String(subgraph.id))!
        .node(String(node.id))!

      expect(visible).not.toBe(viaDefinition)
      expect(comfy.sameEntity(visible, viaDefinition)).toBe(true)
    })

    it('reports different nodes as different', () => {
      const first = new LGraphNode('A', 'Alpha')
      const second = new LGraphNode('B', 'Beta')
      graph.add(first)
      graph.add(second)
      const comfy = createComfyApi(() => graph)

      expect(
        comfy.sameEntity(
          comfy.graph.node(String(first.id)),
          comfy.graph.node(String(second.id))
        )
      ).toBe(false)
    })

    it('does not mistake non-handles for entities', () => {
      const comfy = createComfyApi(() => graph)
      expect(comfy.sameEntity({}, {})).toBe(false)
      expect(comfy.sameEntity(null, undefined)).toBe(false)
      expect(comfy.sameEntity('a', 'a')).toBe(false)
    })

    it('adopts a foreign handle into this instance', () => {
      const node = new LGraphNode('A', 'Alpha')
      graph.add(node)
      const one = createComfyApi(() => graph)
      const two = createComfyApi(() => graph)

      const foreign = one.graph.node(String(node.id))!
      const adopted = two.adopt(foreign)

      expect(adopted).toBeDefined()
      expect(adopted).toBe(two.graph.node(String(node.id)))
      expect(adopted).not.toBe(foreign)
      expect(adopted!.getTitle()).toBe('A')
    })

    it('returns undefined when adopting a non-handle or a dead entity', () => {
      const node = new LGraphNode('A', 'Alpha')
      graph.add(node)
      const one = createComfyApi(() => graph)
      const two = createComfyApi(() => graph)
      const foreign = one.graph.node(String(node.id))!

      expect(two.adopt({})).toBeUndefined()
      expect(two.adopt(undefined)).toBeUndefined()

      graph.remove(node)
      expect(two.adopt(foreign)).toBeUndefined()
    })

    it('keeps the identity token out of spreads and JSON', () => {
      const node = new LGraphNode('A', 'Alpha')
      graph.add(node)
      const handle = createComfyApi(() => graph).graph.node(String(node.id))!

      expect(Object.keys({ ...handle })).not.toContain('kind')
      expect(JSON.stringify(handle)).not.toContain('comfy.handle')
    })
  })

  describe('majors', () => {
    it('serves the latest major by default', () => {
      expect(api().major).toBe(LATEST_MAJOR)
    })

    it('pins to a requested major', () => {
      expect(api().forMajor(LATEST_MAJOR).major).toBe(LATEST_MAJOR)
    })

    it('returns a stable instance per major', () => {
      const comfy = api()
      expect(comfy.forMajor(LATEST_MAJOR)).toBe(comfy.forMajor(LATEST_MAJOR))
    })

    it('reports every supported major', () => {
      expect(SUPPORTED_MAJORS).toContain(LATEST_MAJOR)
      expect(SUPPORTED_MAJORS.length).toBeGreaterThan(0)
    })

    it('fails clearly for a major this host does not know', () => {
      expect(() => api().forMajor(99)).toThrow(ComfyUnsupportedError)
      expect(() => api().forMajor(99)).toThrow(/API major 99/)
    })
  })

  describe('handle caches are keyed by major', () => {
    it('does not share handles between majors', () => {
      const node = new LGraphNode('A', 'Alpha')
      graph.add(node)
      const comfy = createComfyApi(() => graph)

      const fromLatest = comfy.graph.node(String(node.id))!
      const fromPinned = comfy
        .forMajor(LATEST_MAJOR)
        .graph.node(String(node.id))!

      // Same major here, so the same instance is reused.
      expect(fromPinned).toBe(fromLatest)
      // ...and identity holds regardless.
      expect(comfy.sameEntity(fromPinned, fromLatest)).toBe(true)
    })

    it('keeps slot identity agreeing across instances', () => {
      const node = new LGraphNode('A', 'Alpha')
      node.addOutput('IMAGE', 'IMAGE')
      graph.add(node)

      // Slot ids are intentionally global: a slot is the same slot whichever
      // API instance or major observes it.
      const one = createComfyApi(() => graph)
      const two = createComfyApi(() => graph)
      expect(one.graph.node(String(node.id))!.outputs.at(0)!.id).toBe(
        two.graph.node(String(node.id))!.outputs.at(0)!.id
      )
    })

    it('scopes widget handles per node, not globally by name', () => {
      const a = new LGraphNode('A', 'Alpha')
      const b = new LGraphNode('B', 'Alpha')
      graph.add(a)
      graph.add(b)
      a.addWidget('number', 'seed', 1, () => undefined, {})
      b.addWidget('number', 'seed', 2, () => undefined, {})

      const comfy = createComfyApi(() => graph)
      const wa = comfy.graph.node(String(a.id))!.widgets.get('seed')!
      const wb = comfy.graph.node(String(b.id))!.widgets.get('seed')!

      expect(wa).not.toBe(wb)
      expect(wa.getValue()).toBe(1)
      expect(wb.getValue()).toBe(2)
    })
  })

  it('is frozen so packs cannot patch the root', () => {
    const comfy = api()
    expect(Object.isFrozen(comfy)).toBe(true)
    expect(() => {
      ;(comfy as { version: string }).version = '9.9.9'
    }).toThrow()
  })
})
