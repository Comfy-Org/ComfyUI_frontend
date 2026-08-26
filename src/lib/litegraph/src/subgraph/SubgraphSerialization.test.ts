/**
 * SubgraphSerialization Tests
 *
 * Tests for saving, loading, and version compatibility of subgraphs.
 * This covers serialization, deserialization, data integrity, and migration scenarios.
 */
import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { afterEach, assert, beforeEach, describe, expect, it } from 'vitest'

import { duplicateSubgraphNodeIds } from '@/lib/litegraph/src/__fixtures__/duplicateSubgraphNodeIds'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import {
  LGraph,
  LGraphNode,
  LLink,
  LiteGraph,
  Subgraph
} from '@/lib/litegraph/src/litegraph'

import { toLinkId } from '@/types/linkId'
import { toNodeId, UNASSIGNED_NODE_ID } from '@/types/nodeId'
import { createUuidv4 } from '@/utils/uuid'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

class DummyNode extends LGraphNode {}

const DUPLICATE_ID_SUBGRAPH_A = '11111111-1111-4111-8111-111111111111'
const DUPLICATE_ID_SUBGRAPH_B = '22222222-2222-4222-8222-222222222222'
const LEGACY_SUBGRAPH_INPUT_ID = -10
const LEGACY_SUBGRAPH_OUTPUT_ID = -20

beforeEach(() => {
  resetSubgraphFixtureState()
  LiteGraph.registerNodeType('dummy', DummyNode)
})

afterEach(() => {
  delete LiteGraph.registered_node_types.dummy
})

describe('SubgraphSerialization - Basic Serialization', () => {
  it('rekeys a registered subgraph and preserves its interface', () => {
    const root = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: root, name: 'Stored' })
    root.subgraphs.set(subgraph.id, subgraph)

    expect(root.subgraphs.get(subgraph.id)).toBe(subgraph)

    const previousId = subgraph.id
    subgraph.id = createUuidv4()
    const input = subgraph.addInput('input', 'number')
    const output = subgraph.addOutput('output', 'number')
    expect(subgraph.name).toBe('Stored')
    expect(subgraph.inputs).toEqual([input])
    expect(subgraph.outputs).toEqual([output])

    expect(() => {
      subgraph.id = createUuidv4()
    }).not.toThrow()
    expect(root.subgraphs.get(subgraph.id)).toBe(subgraph)
    expect(root.subgraphs.has(previousId)).toBe(false)
  })

  it('should save and load simple subgraphs', () => {
    const original = createTestSubgraph({
      name: 'Simple Test',
      nodeCount: 2
    })
    original.addInput('in1', 'number')
    original.addInput('in2', 'string')
    original.addOutput('out', 'boolean')

    // Serialize
    const exported = original.asSerialisable()

    // Verify exported structure
    expect(exported).toHaveProperty('id', original.id)
    expect(exported).toHaveProperty('name', 'Simple Test')
    expect(exported).toHaveProperty('nodes')
    expect(exported).toHaveProperty('links')
    expect(exported).toHaveProperty('inputs')
    expect(exported).toHaveProperty('outputs')
    expect(exported).toHaveProperty('version')

    // Create new instance from serialized data
    const restored = new Subgraph(new LGraph(), exported)

    // Verify structure is preserved
    expect(restored.id).toBe(original.id)
    expect(restored.name).toBe(original.name)
    expect(restored.inputs.length).toBe(2) // Only added inputs, not original nodeCount
    expect(restored.outputs.length).toBe(1)
    // Note: nodes may not be restored if they're not registered types
    // This is expected behavior - serialization preserves I/O but nodes need valid types

    // Verify input details
    expect(restored.inputs[0].name).toBe('in1')
    expect(restored.inputs[0].type).toBe('number')
    expect(restored.inputs[1].name).toBe('in2')
    expect(restored.inputs[1].type).toBe('string')
    expect(restored.outputs[0].name).toBe('out')
    expect(restored.outputs[0].type).toBe('boolean')
  })

  it('should verify all properties are preserved', () => {
    const original = createTestSubgraph({
      name: 'Property Test',
      nodeCount: 3,
      inputs: [
        { name: 'input1', type: 'number' },
        { name: 'input2', type: 'string' }
      ],
      outputs: [
        { name: 'output1', type: 'boolean' },
        { name: 'output2', type: 'array' }
      ]
    })

    const exported = original.asSerialisable()
    const restored = new Subgraph(new LGraph(), exported)

    // Verify core properties
    expect(restored.id).toBe(original.id)
    expect(restored.name).toBe(original.name)
    expect(restored.description).toBe(original.description)

    // Verify I/O structure
    expect(restored.inputs.length).toBe(original.inputs.length)
    expect(restored.outputs.length).toBe(original.outputs.length)
    // Nodes may not be restored if they don't have registered types

    // Verify I/O details match
    for (let i = 0; i < original.inputs.length; i++) {
      expect(restored.inputs[i].name).toBe(original.inputs[i].name)
      expect(restored.inputs[i].type).toBe(original.inputs[i].type)
    }

    for (let i = 0; i < original.outputs.length; i++) {
      expect(restored.outputs[i].name).toBe(original.outputs[i].name)
      expect(restored.outputs[i].type).toBe(original.outputs[i].type)
    }
  })

  it('should test export() and configure() methods', () => {
    const subgraph = createTestSubgraph({ nodeCount: 1 })
    subgraph.addInput('test_input', 'number')
    subgraph.addOutput('test_output', 'string')

    // Test export
    const exported = subgraph.asSerialisable()
    expect(exported).toHaveProperty('id')
    expect(exported).toHaveProperty('nodes')
    expect(exported).toHaveProperty('links')
    expect(exported).toHaveProperty('inputs')
    expect(exported).toHaveProperty('outputs')

    // Test configure with partial data
    const newSubgraph = createTestSubgraph({ nodeCount: 0 })
    expect(() => {
      newSubgraph.configure(exported)
    }).not.toThrow()

    // Verify configuration applied
    expect(newSubgraph.inputs.length).toBe(1)
    expect(newSubgraph.outputs.length).toBe(1)
    expect(newSubgraph.inputs[0].name).toBe('test_input')
    expect(newSubgraph.outputs[0].name).toBe('test_output')
  })
})

describe('SubgraphSerialization - Complex Serialization', () => {
  it('should serialize nested subgraphs with multiple levels', () => {
    // Create a nested structure
    const childSubgraph = createTestSubgraph({
      name: 'Child',
      nodeCount: 2,
      inputs: [{ name: 'child_in', type: 'number' }],
      outputs: [{ name: 'child_out', type: 'string' }]
    })

    const parentSubgraph = createTestSubgraph({
      name: 'Parent',
      nodeCount: 1,
      inputs: [{ name: 'parent_in', type: 'boolean' }],
      outputs: [{ name: 'parent_out', type: 'array' }]
    })

    // Add child to parent
    const childInstance = createTestSubgraphNode(childSubgraph, { id: 100 })
    parentSubgraph.add(childInstance)

    // Serialize both
    const childExported = childSubgraph.asSerialisable()
    const parentExported = parentSubgraph.asSerialisable()

    // Verify both can be serialized
    expect(childExported).toHaveProperty('name', 'Child')
    expect(parentExported).toHaveProperty('name', 'Parent')
    expect(parentExported.nodes.length).toBe(2) // 1 original + 1 child subgraph

    // Restore and verify
    const restoredChild = new Subgraph(new LGraph(), childExported)
    const restoredParent = new Subgraph(new LGraph(), parentExported)

    expect(restoredChild.name).toBe('Child')
    expect(restoredParent.name).toBe('Parent')
    expect(restoredChild.inputs.length).toBe(1)
    expect(restoredParent.inputs.length).toBe(1)
  })

  it('should serialize subgraphs with many nodes and connections', () => {
    const largeSubgraph = createTestSubgraph({
      name: 'Large Subgraph',
      nodeCount: 10 // Many nodes
    })

    // Add many I/O slots
    for (let i = 0; i < 5; i++) {
      largeSubgraph.addInput(`input_${i}`, 'number')
      largeSubgraph.addOutput(`output_${i}`, 'string')
    }

    const exported = largeSubgraph.asSerialisable()
    const restored = new Subgraph(new LGraph(), exported)

    // Verify I/O data preserved
    expect(restored.inputs.length).toBe(5)
    expect(restored.outputs.length).toBe(5)
    // Nodes may not be restored if they don't have registered types

    // Verify I/O naming preserved
    for (let i = 0; i < 5; i++) {
      expect(restored.inputs[i].name).toBe(`input_${i}`)
      expect(restored.outputs[i].name).toBe(`output_${i}`)
    }
  })

  it('should preserve I/O even when nodes are not restored', () => {
    const subgraph = createTestSubgraph({
      nodeCount: 2,
      inputs: [{ name: 'data_in', type: 'number' }],
      outputs: [{ name: 'data_out', type: 'string' }]
    })

    const exported = subgraph.asSerialisable()
    const restored = new Subgraph(new LGraph(), exported)

    // Nodes are not restored without registered types
    expect(restored.nodes).toHaveLength(0)

    // I/O is still preserved
    expect(restored.inputs).toHaveLength(1)
    expect(restored.inputs[0].name).toBe('data_in')
    expect(restored.outputs).toHaveLength(1)
    expect(restored.outputs[0].name).toBe('data_out')
  })
})

describe('SubgraphSerialization - Version Compatibility', () => {
  it('should handle version field in exports', () => {
    const subgraph = createTestSubgraph({ nodeCount: 1 })
    const exported = subgraph.asSerialisable()

    // Should have version field
    expect(exported).toHaveProperty('version')
    expect(typeof exported.version).toBe('number')
  })

  it('should load version 1.0+ format', () => {
    const modernFormat = {
      version: 1, // Number as expected by current implementation
      id: 'test-modern-id',
      name: 'Modern Subgraph',
      nodes: [],
      links: {},
      groups: [],
      config: {},
      definitions: { subgraphs: [] },
      inputs: [{ id: 'input-id', name: 'modern_input', type: 'number' }],
      outputs: [{ id: 'output-id', name: 'modern_output', type: 'string' }],
      inputNode: {
        id: LEGACY_SUBGRAPH_INPUT_ID,
        bounding: [0, 0, 120, 60]
      },
      outputNode: {
        id: LEGACY_SUBGRAPH_OUTPUT_ID,
        bounding: [300, 0, 120, 60]
      },
      widgets: []
    }

    expect(() => {
      // @ts-expect-error Type mismatch in ExportedSubgraph format
      const subgraph = new Subgraph(new LGraph(), modernFormat)
      expect(subgraph.name).toBe('Modern Subgraph')
      expect(subgraph.inputs.length).toBe(1)
      expect(subgraph.outputs.length).toBe(1)
      expect(subgraph.inputNode.id).toBe(SUBGRAPH_INPUT_ID)
      expect(subgraph.outputNode.id).toBe(SUBGRAPH_OUTPUT_ID)
    }).not.toThrow()
  })

  it('should handle missing fields gracefully', () => {
    const incompleteFormat = {
      version: 1,
      id: 'incomplete-id',
      name: 'Incomplete Subgraph',
      nodes: [],
      links: {},
      groups: [],
      config: {},
      definitions: { subgraphs: [] },
      inputNode: {
        id: LEGACY_SUBGRAPH_INPUT_ID,
        bounding: [0, 0, 120, 60]
      },
      outputNode: {
        id: LEGACY_SUBGRAPH_OUTPUT_ID,
        bounding: [300, 0, 120, 60]
      }
      // Missing optional: inputs, outputs, widgets
    }

    expect(() => {
      // @ts-expect-error Type mismatch in ExportedSubgraph format
      const subgraph = new Subgraph(new LGraph(), incompleteFormat)
      expect(subgraph.name).toBe('Incomplete Subgraph')
      // Should have default empty arrays
      expect(Array.isArray(subgraph.inputs)).toBe(true)
      expect(Array.isArray(subgraph.outputs)).toBe(true)
      expect(subgraph.inputNode.id).toBe(SUBGRAPH_INPUT_ID)
      expect(subgraph.outputNode.id).toBe(SUBGRAPH_OUTPUT_ID)
    }).not.toThrow()
  })

  it('should consider future-proofing', () => {
    const futureFormat = {
      version: 2, // Future version (number)
      id: 'future-id',
      name: 'Future Subgraph',
      nodes: [],
      links: {},
      groups: [],
      config: {},
      definitions: { subgraphs: [] },
      inputs: [],
      outputs: [],
      inputNode: {
        id: LEGACY_SUBGRAPH_INPUT_ID,
        bounding: [0, 0, 120, 60]
      },
      outputNode: {
        id: LEGACY_SUBGRAPH_OUTPUT_ID,
        bounding: [300, 0, 120, 60]
      },
      widgets: [],
      futureFeature: 'unknown_data' // Unknown future field
    }

    // Should handle future format gracefully
    expect(() => {
      // @ts-expect-error Type mismatch in ExportedSubgraph format
      const subgraph = new Subgraph(new LGraph(), futureFormat)
      expect(subgraph.name).toBe('Future Subgraph')
      expect(subgraph.inputNode.id).toBe(SUBGRAPH_INPUT_ID)
      expect(subgraph.outputNode.id).toBe(SUBGRAPH_OUTPUT_ID)
    }).not.toThrow()
  })
})

describe('SubgraphSerialization - Data Integrity', () => {
  it('should pass round-trip testing (save → load → save → compare)', () => {
    const original = createTestSubgraph({
      name: 'Round Trip Test',
      nodeCount: 3,
      inputs: [
        { name: 'rt_input1', type: 'number' },
        { name: 'rt_input2', type: 'string' }
      ],
      outputs: [{ name: 'rt_output1', type: 'boolean' }]
    })

    // First round trip
    const exported1 = original.asSerialisable()
    const restored1 = new Subgraph(new LGraph(), exported1)

    // Second round trip
    const exported2 = restored1.asSerialisable()
    const restored2 = new Subgraph(new LGraph(), exported2)

    // Compare key properties
    expect(restored2.id).toBe(original.id)
    expect(restored2.name).toBe(original.name)
    expect(restored2.inputs.length).toBe(original.inputs.length)
    expect(restored2.outputs.length).toBe(original.outputs.length)
    // Nodes may not be restored if they don't have registered types

    // Compare I/O details
    for (let i = 0; i < original.inputs.length; i++) {
      expect(restored2.inputs[i].name).toBe(original.inputs[i].name)
      expect(restored2.inputs[i].type).toBe(original.inputs[i].type)
    }

    for (let i = 0; i < original.outputs.length; i++) {
      expect(restored2.outputs[i].name).toBe(original.outputs[i].name)
      expect(restored2.outputs[i].type).toBe(original.outputs[i].type)
    }
  })

  it('should verify IDs remain unique', () => {
    const subgraph1 = createTestSubgraph({ name: 'Unique1', nodeCount: 2 })
    const subgraph2 = createTestSubgraph({ name: 'Unique2', nodeCount: 2 })

    const exported1 = subgraph1.asSerialisable()
    const exported2 = subgraph2.asSerialisable()

    // IDs should be unique
    expect(exported1.id).not.toBe(exported2.id)

    const restored1 = new Subgraph(new LGraph(), exported1)
    const restored2 = new Subgraph(new LGraph(), exported2)

    expect(restored1.id).not.toBe(restored2.id)
    expect(restored1.id).toBe(subgraph1.id)
    expect(restored2.id).toBe(subgraph2.id)
  })

  it('should maintain connection integrity after load', () => {
    const subgraph = createTestSubgraph({ nodeCount: 2 })
    subgraph.addInput('connection_test', 'number')
    subgraph.addOutput('connection_result', 'string')

    const exported = subgraph.asSerialisable()
    const restored = new Subgraph(new LGraph(), exported)

    // Verify I/O connections can be established
    expect(restored.inputs.length).toBe(1)
    expect(restored.outputs.length).toBe(1)
    expect(restored.inputs[0].name).toBe('connection_test')
    expect(restored.outputs[0].name).toBe('connection_result')

    // Verify subgraph can be instantiated
    const instance = createTestSubgraphNode(restored)
    expect(instance.inputs.length).toBe(1)
    expect(instance.outputs.length).toBe(1)
  })

  it('should not restore nodes without registered types', () => {
    const subgraph = createTestSubgraph({ nodeCount: 2 })

    // Nodes exist before serialization
    expect(subgraph.nodes).toHaveLength(2)

    const exported = subgraph.asSerialisable()
    const restored = new Subgraph(new LGraph(), exported)

    // Nodes are not restored without registered types
    expect(restored.nodes).toHaveLength(0)
  })

  it('should preserve interior link structure through serialization', () => {
    const subgraph = createTestSubgraph({ nodeCount: 0 })

    const nodeA = createTestNode(subgraph, [], ['number'], 'A')
    const nodeB = createTestNode(subgraph, ['number'], ['string'], 'B')
    const nodeC = createTestNode(subgraph, ['string'], [], 'C')

    nodeA.connect(0, nodeB, 0)
    nodeB.connect(0, nodeC, 0)

    expect(subgraph.nodes).toHaveLength(3)
    expect(subgraph.links.size).toBe(2)

    const exported = subgraph.asSerialisable()
    const restored = new Subgraph(new LGraph(), exported)
    restored.configure(exported)

    expect(restored.nodes).toHaveLength(3)
    expect(restored.links.size).toBe(2)

    for (const [, link] of restored.links) {
      const originNode = restored.getNodeById(link.origin_id)
      const targetNode = restored.getNodeById(link.target_id)
      expect(originNode).toBeDefined()
      expect(targetNode).toBeDefined()
      expect(link.origin_slot).toBeGreaterThanOrEqual(0)
      expect(link.target_slot).toBeGreaterThanOrEqual(0)
      expect(originNode!.outputs[link.origin_slot]).toBeDefined()
      expect(targetNode!.inputs[link.target_slot]).toBeDefined()
    }
  })

  it('serializes interior links with contract key order and round-trips byte-identically', () => {
    const subgraph = createTestSubgraph({ nodeCount: 0 })

    const nodeA = createTestNode(subgraph, [], ['number'], 'A')
    const nodeB = createTestNode(subgraph, ['number'], ['string'], 'B')
    const nodeC = createTestNode(subgraph, ['string'], [], 'C')

    nodeA.connect(0, nodeB, 0)
    nodeB.connect(0, nodeC, 0)

    const first = subgraph.asSerialisable()
    expect(first.links?.length).toBe(2)
    for (const link of first.links ?? []) {
      expect(Object.keys(link)).toEqual([
        'id',
        'origin_id',
        'origin_slot',
        'target_id',
        'target_slot',
        'type'
      ])
    }

    const restored = new Subgraph(new LGraph(), first)
    restored.configure(first)
    const second = restored.asSerialisable()

    expect(JSON.stringify(second.links)).toBe(JSON.stringify(first.links))
  })

  it('preserves owned topology through serialization and configure', () => {
    const subgraph = createTestSubgraph({ nodeCount: 0 })
    const origin = createTestNode(subgraph, [], ['number'], 'Origin')
    const target = createTestNode(subgraph, ['number'], [], 'Target')
    const link = origin.connect(0, target, 0)!
    const floatingLink = new LLink(
      toLinkId(-1),
      'number',
      origin.id,
      0,
      UNASSIGNED_NODE_ID,
      -1
    )
    const storedFloatingLink = subgraph.addFloatingLink(floatingLink)
    assert(storedFloatingLink)
    subgraph.createReroute([10, 20], link)
    subgraph.createReroute([30, 40], storedFloatingLink)

    const exported = structuredClone(subgraph.asSerialisable())
    const rootGraph = subgraph.rootGraph
    subgraph.clear()
    const restored = createTestSubgraph({ rootGraph, nodeCount: 0 })
    restored.configure(exported)

    expect(restored.links.size).toBe(1)
    expect(restored.floatingLinks.size).toBe(1)
    expect(restored.reroutes.size).toBe(2)
    expect(restored.asSerialisable()).toMatchObject({
      links: exported.links,
      floatingLinks: exported.floatingLinks,
      reroutes: exported.reroutes
    })
  })

  it('remaps rejected link aliases without mutating subgraph input', () => {
    const subgraph = createTestSubgraph({
      nodeCount: 0,
      outputs: [{ name: 'value', type: 'number' }]
    })
    const origin = createTestNode(subgraph, [], ['number'], 'Origin')
    const link = subgraph.outputs[0].connect(origin.outputs[0], origin)
    assert(link)
    const data = structuredClone(subgraph.asSerialisable())
    const rejectedId = toLinkId(link.id + 1)
    data.links!.push({ ...data.links![0], id: rejectedId })
    data.outputs![0].linkIds = [rejectedId]
    const original = structuredClone(data)
    const expectedLinkId = link.id
    subgraph.clear()

    const restored = createTestSubgraph({
      rootGraph: subgraph.rootGraph,
      nodeCount: 0
    })
    restored.configure(data)

    expect(restored.outputs[0].linkIds).toEqual([expectedLinkId])
    expect(data).toEqual(original)
  })

  it('deduplicates duplicate subgraph node IDs while keeping root nodes canonical', () => {
    const graph = new LGraph()
    const data = structuredClone(duplicateSubgraphNodeIds)
    const expectedRootIds = data.nodes.map((node) => Number(node.id))
    graph.configure(data)

    const rootIds = graph.nodes.map((node) => Number(node.id))
    expect(new Set(rootIds)).toEqual(new Set(expectedRootIds))

    const subgraphAIds = graph.subgraphs
      .get(DUPLICATE_ID_SUBGRAPH_A)!
      .nodes.map((node) => Number(node.id))
    const subgraphBIds = graph.subgraphs
      .get(DUPLICATE_ID_SUBGRAPH_B)!
      .nodes.map((node) => Number(node.id))
    const allIds = [...rootIds, ...subgraphAIds, ...subgraphBIds]
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('patches remapped link and proxyWidget references during duplicate-ID hydration', () => {
    const graph = new LGraph()
    graph.configure(structuredClone(duplicateSubgraphNodeIds))

    const subgraphAIds = new Set(
      graph.subgraphs
        .get(DUPLICATE_ID_SUBGRAPH_A)!
        .nodes.map((node) => String(node.id))
    )
    const subgraphB = graph.subgraphs.get(DUPLICATE_ID_SUBGRAPH_B)!
    const subgraphBIds = new Set(subgraphB.nodes.map((node) => String(node.id)))

    const rootProxyWidgetsA = graph.getNodeById(toNodeId(102))?.properties
      ?.proxyWidgets
    expect(Array.isArray(rootProxyWidgetsA)).toBe(true)
    for (const entry of rootProxyWidgetsA as string[][]) {
      expect(subgraphAIds.has(String(entry[0]))).toBe(true)
    }

    const rootProxyWidgetsB = graph.getNodeById(toNodeId(103))?.properties
      ?.proxyWidgets
    expect(Array.isArray(rootProxyWidgetsB)).toBe(true)
    for (const entry of rootProxyWidgetsB as string[][]) {
      expect(subgraphBIds.has(String(entry[0]))).toBe(true)
    }

    for (const [, link] of subgraphB.links) {
      expect(subgraphBIds.has(String(link.origin_id))).toBe(true)
      expect(subgraphBIds.has(String(link.target_id))).toBe(true)
    }
  })
})
