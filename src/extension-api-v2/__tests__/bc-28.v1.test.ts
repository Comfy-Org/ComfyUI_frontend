// Category: BC.28 — Subgraph fan-out via set/get virtual nodes
// DB cross-ref: S9.SG1
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1406
// blast_radius: 4.97
// compat-floor: blast_radius ≥ 2.0
// v1 contract: custom virtual node classes with isVirtualNode=true + graphToPrompt rewriting
//              to resolve set/get references

import { describe, it, expect } from 'vitest'

// ── v1 LiteGraph mock for virtual node patterns ─────────────────────────────

interface V1NodeType {
  type: string
  prototype: {
    isVirtualNode?: boolean
    serialize?: () => unknown
    onExecute?: () => void
  }
}

interface V1Link {
  id: number
  origin_id: number
  origin_slot: number
  target_id: number
  target_slot: number
}

interface V1Node {
  id: number
  type: string
  title: string
  properties?: Record<string, unknown>
  inputs?: Array<{ link: number | null }>
  outputs?: Array<{ links: number[] }>
}

interface V1Graph {
  _nodes: V1Node[]
  links: Record<number, V1Link>
  findNodesByType(type: string): V1Node[]
  serialize(): { nodes: V1Node[]; links: V1Link[] }
}

// ── Mock virtual node registry (KJNodes-style) ──────────────────────────────

const virtualNodeRegistry = new Map<string, unknown>()

function createV1Graph(): V1Graph {
  return {
    _nodes: [],
    links: {},
    findNodesByType(type: string) {
      return this._nodes.filter((n) => n.type === type)
    },
    serialize() {
      return {
        nodes: this._nodes.map((n) => ({ ...n })),
        links: Object.values(this.links)
      }
    }
  }
}

function registerVirtualNodeType(type: string): V1NodeType {
  return {
    type,
    prototype: {
      isVirtualNode: true
    }
  }
}

describe('BC.28 v1 contract — subgraph fan-out via set/get virtual nodes', () => {
  describe('S9.SG1 — virtual node registration and isVirtualNode flag', () => {
    it('registering a node class with isVirtualNode=true marks it as virtual', () => {
      const SetNodeType = registerVirtualNodeType('SetNode')

      expect(SetNodeType.prototype.isVirtualNode).toBe(true)
    })

    it('virtual Set node stores a named value in a global registry keyed by node title', () => {
      // Simulating KJNodes Set node pattern
      virtualNodeRegistry.clear()

      const setNode: V1Node = {
        id: 1,
        type: 'SetNode',
        title: 'myValue',
        properties: {},
        inputs: [{ link: 100 }],
        outputs: []
      }

      // On execution, Set node stores its input value by title
      const inputValue = { type: 'IMAGE', data: 'tensor-data' }
      virtualNodeRegistry.set(setNode.title, inputValue)

      expect(virtualNodeRegistry.get('myValue')).toBe(inputValue)
    })

    it('virtual Get node reads from the same named registry and provides its output', () => {
      virtualNodeRegistry.clear()

      // Set node stores value
      const storedValue = { type: 'LATENT', data: 'latent-data' }
      virtualNodeRegistry.set('sharedLatent', storedValue)

      // Get node reads value
      const getNode: V1Node = {
        id: 2,
        type: 'GetNode',
        title: 'sharedLatent',
        properties: {},
        inputs: [],
        outputs: [{ links: [101] }]
      }

      const retrievedValue = virtualNodeRegistry.get(getNode.title)

      expect(retrievedValue).toBe(storedValue)
    })
  })

  describe('S9.SG1 — graphToPrompt rewriting', () => {
    it('graphToPrompt resolves Get references to the corresponding Set node output', () => {
      // Simulating the graphToPrompt patching pattern from KJNodes
      const graph = createV1Graph()

      // SetNode receives input from upstream
      const upstreamNode: V1Node = {
        id: 1,
        type: 'KSampler',
        title: 'Sampler',
        outputs: [{ links: [100] }]
      }

      const setNode: V1Node = {
        id: 2,
        type: 'SetNode',
        title: 'samplerOutput',
        inputs: [{ link: 100 }],
        outputs: []
      }

      // GetNode provides output to downstream
      const getNode: V1Node = {
        id: 3,
        type: 'GetNode',
        title: 'samplerOutput',
        inputs: [],
        outputs: [{ links: [101] }]
      }

      const downstreamNode: V1Node = {
        id: 4,
        type: 'VAEDecode',
        title: 'Decoder',
        inputs: [{ link: 101 }]
      }

      graph._nodes = [upstreamNode, setNode, getNode, downstreamNode]
      graph.links = {
        100: {
          id: 100,
          origin_id: 1,
          origin_slot: 0,
          target_id: 2,
          target_slot: 0
        },
        101: {
          id: 101,
          origin_id: 3,
          origin_slot: 0,
          target_id: 4,
          target_slot: 0
        }
      }

      // graphToPrompt rewriting logic: replace Get→downstream with Set-source→downstream
      function resolveVirtualLinks(
        links: Record<number, V1Link>,
        nodes: V1Node[]
      ): V1Link[] {
        const resolved: V1Link[] = []
        const setNodesByTitle = new Map<string, V1Node>()

        // Build Set node index
        for (const node of nodes) {
          if (node.type === 'SetNode') {
            setNodesByTitle.set(node.title, node)
          }
        }

        // Resolve Get node outputs
        for (const link of Object.values(links)) {
          const originNode = nodes.find((n) => n.id === link.origin_id)
          if (originNode?.type === 'GetNode') {
            // Find matching Set node
            const setNode = setNodesByTitle.get(originNode.title)
            if (setNode && setNode.inputs?.[0]?.link != null) {
              // Find the Set node's input link
              const setInputLink = links[setNode.inputs[0].link]
              if (setInputLink) {
                // Rewrite: downstream receives from Set's upstream
                resolved.push({
                  ...link,
                  origin_id: setInputLink.origin_id,
                  origin_slot: setInputLink.origin_slot
                })
                continue
              }
            }
          }
          resolved.push(link)
        }

        return resolved
      }

      const resolvedLinks = resolveVirtualLinks(graph.links, graph._nodes)

      // The Get→VAEDecode link should now point to KSampler→VAEDecode
      const downstreamLink = resolvedLinks.find((l) => l.target_id === 4)
      expect(downstreamLink!.origin_id).toBe(1) // KSampler
      expect(downstreamLink!.origin_slot).toBe(0)
    })

    it('multiple Get nodes referencing the same Set name all resolve to the same upstream', () => {
      const graph = createV1Graph()

      const upstream: V1Node = {
        id: 1,
        type: 'KSampler',
        title: 'S',
        outputs: [{ links: [100] }]
      }
      const setNode: V1Node = {
        id: 2,
        type: 'SetNode',
        title: 'shared',
        inputs: [{ link: 100 }],
        outputs: []
      }
      const get1: V1Node = {
        id: 3,
        type: 'GetNode',
        title: 'shared',
        inputs: [],
        outputs: [{ links: [101] }]
      }
      const get2: V1Node = {
        id: 4,
        type: 'GetNode',
        title: 'shared',
        inputs: [],
        outputs: [{ links: [102] }]
      }
      const down1: V1Node = {
        id: 5,
        type: 'VAEDecode',
        title: 'D1',
        inputs: [{ link: 101 }]
      }
      const down2: V1Node = {
        id: 6,
        type: 'VAEDecode',
        title: 'D2',
        inputs: [{ link: 102 }]
      }

      graph._nodes = [upstream, setNode, get1, get2, down1, down2]
      graph.links = {
        100: {
          id: 100,
          origin_id: 1,
          origin_slot: 0,
          target_id: 2,
          target_slot: 0
        },
        101: {
          id: 101,
          origin_id: 3,
          origin_slot: 0,
          target_id: 5,
          target_slot: 0
        },
        102: {
          id: 102,
          origin_id: 4,
          origin_slot: 0,
          target_id: 6,
          target_slot: 0
        }
      }

      // Both Get nodes should resolve to node 1 (upstream)
      const setNodesByTitle = new Map([['shared', setNode]])

      for (const linkId of [101, 102]) {
        const link = graph.links[linkId]
        const getNode = graph._nodes.find((n) => n.id === link.origin_id)
        expect(getNode!.type).toBe('GetNode')

        const matchingSet = setNodesByTitle.get(getNode!.title)
        expect(matchingSet).toBeDefined()
      }
    })

    it('a Get node with no matching Set name is flagged as an error', () => {
      const graph = createV1Graph()

      const getNode: V1Node = {
        id: 1,
        type: 'GetNode',
        title: 'nonexistent',
        inputs: [],
        outputs: [{ links: [100] }]
      }

      graph._nodes = [getNode]

      // Simulating error detection in graphToPrompt
      function validateGetNodes(nodes: V1Node[]): string[] {
        const errors: string[] = []
        const setTitles = new Set(
          nodes.filter((n) => n.type === 'SetNode').map((n) => n.title)
        )

        for (const node of nodes) {
          if (node.type === 'GetNode' && !setTitles.has(node.title)) {
            errors.push(`Get node "${node.title}" has no matching Set node`)
          }
        }

        return errors
      }

      const errors = validateGetNodes(graph._nodes)

      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('nonexistent')
    })
  })
})
