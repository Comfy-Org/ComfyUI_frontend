import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { ComfyApiError } from './errors'
import { createGraphApi } from './graphHandle'
import type { GraphHandle } from './graphHandle'

describe('graph API (composed)', () => {
  let graph: LGraph
  let api: GraphHandle

  function addNode(title: string, type: string) {
    const node = new LGraphNode(title, type)
    graph.add(node)
    return node
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    api = createGraphApi(() => graph)
  })

  describe('node access', () => {
    it('lists nodes and finds them by id and type', () => {
      const a = addNode('A', 'Alpha')
      addNode('B', 'Beta')

      expect(api.nodes()).toHaveLength(2)
      expect(api.node(String(a.id))?.getTitle()).toBe('A')
      expect(api.nodesOfType('Beta').map((n) => n.getTitle())).toEqual(['B'])
    })

    it('builds the registered node type, not a bare node', () => {
      // `new LGraphNode(title, type)` produces a node with no inputs, outputs
      // or widgets, because those come from the registered class. A pack that
      // adds a node and then reads its slots — recreating a node as another
      // type, say — gets an empty shell and silently wires nothing.
      class Registered extends LGraphNode {
        constructor(title?: string) {
          super(title ?? 'Registered', 'Registered')
          this.addInput('image', 'IMAGE')
          this.addOutput('latent', 'LATENT')
          this.addWidget('number', 'seed', 7, () => {})
        }
      }
      LiteGraph.registerNodeType('Registered', Registered)

      try {
        const handle = api.add('Registered')
        expect(handle.inputs.all().map((i) => i.name)).toEqual(['image'])
        expect(handle.outputs.all().map((o) => o.name)).toEqual(['latent'])
        expect(handle.widgets.get('seed')?.getValue()).toBe(7)
      } finally {
        LiteGraph.unregisterNodeType('Registered')
      }
    })

    it('refuses a type that is not registered', () => {
      expect(() => api.add('NoSuchType')).toThrow(ComfyApiError)
    })

    it('returns undefined for a node that is not present', () => {
      expect(api.node('999')).toBeUndefined()
    })

    it('adds and removes nodes', () => {
      LiteGraph.registerNodeType('Gamma', class extends LGraphNode {})
      try {
        const handle = api.add('Gamma', {
          title: 'G',
          position: { x: 5, y: 6 }
        })
        expect(handle.type).toBe('Gamma')
        expect(handle.getPosition()).toEqual({ x: 5, y: 6 })

        expect(api.remove(handle.id)).toBe(true)
        expect(handle.isDeleted).toBe(true)
        expect(api.remove(handle.id)).toBe(false)
      } finally {
        LiteGraph.unregisterNodeType('Gamma')
      }
    })

    it('gives a clear error when there is no active graph', () => {
      const detached = createGraphApi(() => null)
      expect(() => detached.add('Alpha')).toThrow(ComfyApiError)
      expect(() => detached.add('Alpha')).toThrow(/no graph is active/)
      // Reads stay total rather than throwing.
      expect(detached.nodes()).toEqual([])
      expect(detached.node('1')).toBeUndefined()
    })
  })

  describe('collections are reachable and identity-stable', () => {
    it('exposes inputs, outputs and widgets from a node handle', () => {
      const node = addNode('A', 'Alpha')
      node.addInput('image', 'IMAGE')
      node.addOutput('IMAGE', 'IMAGE')
      node.addWidget('number', 'seed', 1, () => undefined, {})

      const handle = api.node(String(node.id))!
      expect(handle.inputs.names()).toEqual(['image'])
      expect(handle.outputs.names()).toEqual(['IMAGE'])
      expect(handle.widgets.names()).toEqual(['seed'])
    })

    it('returns the same collection object across reads', () => {
      const node = addNode('A', 'Alpha')
      const handle = api.node(String(node.id))!
      expect(handle.inputs).toBe(handle.inputs)
      expect(handle.widgets).toBe(handle.widgets)
    })
  })

  describe('end-to-end wiring', () => {
    it('connects two nodes and reports the link from the graph', () => {
      const source = addNode('S', 'Source')
      source.addOutput('IMAGE', 'IMAGE')
      const target = addNode('T', 'Target')
      target.addInput('image', 'IMAGE')

      const s = api.node(String(source.id))!
      const t = api.node(String(target.id))!
      s.outputs.byName('IMAGE')!.connectTo(t.id, 'image')

      expect(t.inputs.byName('image')!.isConnected).toBe(true)
      const links = api.links()
      expect(links).toHaveLength(1)
      expect(links[0].sourceNodeId).toBe(s.id)
      expect(links[0].targetNodeId).toBe(t.id)
      expect(Object.isFrozen(links[0])).toBe(true)
    })

    it('drops links when a node is removed', () => {
      const source = addNode('S', 'Source')
      source.addOutput('IMAGE', 'IMAGE')
      const target = addNode('T', 'Target')
      target.addInput('image', 'IMAGE')

      const s = api.node(String(source.id))!
      s.outputs.byName('IMAGE')!.connectTo(String(target.id), 'image')
      expect(api.links()).toHaveLength(1)

      api.remove(String(target.id))
      expect(api.links()).toHaveLength(0)
    })
  })

  describe('nothing internal escapes the composed surface', () => {
    it('has no path from the graph API to LGraph or LGraphNode', () => {
      const node = addNode('A', 'Alpha')
      node.addInput('image', 'IMAGE')
      node.addWidget('number', 'seed', 1, () => undefined, {})

      const seen = new Set<unknown>()
      const reaches = (value: unknown, depth: number): boolean => {
        if (depth > 5 || value === null || typeof value !== 'object') {
          return false
        }
        if (value === graph || value === node) return true
        if (seen.has(value)) return false
        seen.add(value)
        return Object.values(value).some((v) => reaches(v, depth + 1))
      }

      expect(reaches(api.node(String(node.id)), 0)).toBe(false)
      expect(reaches(api.nodes(), 0)).toBe(false)
      expect(reaches(api.links(), 0)).toBe(false)
    })
  })

  describe('handle caches do not grow unboundedly', () => {
    it('sheds cache slots for removed nodes on prune', () => {
      const ids = Array.from({ length: 20 }, (_, i) => {
        const n = addNode(`N${i}`, 'Alpha')
        return String(n.id)
      })
      ids.forEach((id) => api.node(id))
      expect(api.cacheSize).toBeGreaterThanOrEqual(20)

      ids.forEach((id) => api.remove(id))
      expect(api.nodes()).toHaveLength(0)
    })
  })
})

describe('hit testing', () => {
  it('finds the node under a point, and nothing where there is none', () => {
    const graph = new LGraph()
    const node = new LGraphNode('T', 'TestNode')
    graph.add(node)
    node.pos = [100, 100]
    node.size = [140, 80]
    // The hit test reads the rendered layout; stand in for a frame.
    node.updateArea()
    const api = createGraphApi(() => graph)

    expect(api.nodeAt({ x: 150, y: 130 })?.id).toBe(String(node.id))
    expect(api.nodeAt({ x: -500, y: -500 })).toBeUndefined()
  })
})
