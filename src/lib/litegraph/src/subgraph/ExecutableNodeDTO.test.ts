import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ExecutableNodeDTO,
  LGraph,
  LGraphEventMode,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { NullGraphError } from '@/lib/litegraph/src/infrastructure/NullGraphError'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import {
  createNestedSubgraphs,
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('ExecutableNodeDTO Creation', () => {
  it('should create DTO from regular node', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    node.addInput('in', 'number')
    node.addOutput('out', 'string')
    graph.add(node)

    const executableNodes = new Map()
    const dto = new ExecutableNodeDTO(node, [], executableNodes, undefined)

    expect(dto.node).toBe(node)
    expect(dto.subgraphNodePath).toEqual([])
    expect(dto.subgraphNode).toBeUndefined()
    expect(dto.id).toBe(node.id.toString())
  })

  it('should create DTO with subgraph path', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Inner Node')
    node.id = toNodeId(42)
    graph.add(node)
    const subgraphPath = ['10', '20'] as const

    const dto = new ExecutableNodeDTO(node, subgraphPath, new Map(), undefined)

    expect(dto.subgraphNodePath).toBe(subgraphPath)
    expect(dto.id).toBe('10:20:42')
  })

  it('should clone input slot data', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    node.addInput('input1', 'number')
    node.addInput('input2', 'string')
    node.inputs[0].link = toLinkId(123) // Simulate connected input
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    expect(dto.inputs).toHaveLength(2)
    expect(dto.inputs[0].name).toBe('input1')
    expect(dto.inputs[0].type).toBe('number')
    expect(dto.inputs[0].linkId).toBe(123)
    expect(dto.inputs[1].name).toBe('input2')
    expect(dto.inputs[1].type).toBe('string')
    expect(dto.inputs[1].linkId).toBeNull()

    // Should be a copy, not reference
    expect(dto.inputs).not.toBe(node.inputs)
  })

  it('should inherit graph reference', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    expect(dto.graph).toBe(graph)
  })

  it('should wrap applyToGraph method if present', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    const mockApplyToGraph = vi.fn()
    Object.assign(node, { applyToGraph: mockApplyToGraph })
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    expect(dto.applyToGraph).toBeDefined()

    const args = ['arg1', 'arg2']
    ;(dto.applyToGraph as (...args: unknown[]) => void)(args[0], args[1])

    expect(mockApplyToGraph).toHaveBeenCalledWith(args[0], args[1])
  })

  it("should not create applyToGraph wrapper if method doesn't exist", () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    expect(dto.applyToGraph).toBeUndefined()
  })
})

describe('ExecutableNodeDTO Path-Based IDs', () => {
  it('should generate simple ID for root node', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Root Node')
    node.id = toNodeId(5)
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    expect(dto.id).toBe('5')
  })

  it('should generate path-based ID for nested node', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Nested Node')
    node.id = toNodeId(3)
    graph.add(node)
    const path = ['1', '2'] as const

    const dto = new ExecutableNodeDTO(node, path, new Map(), undefined)

    expect(dto.id).toBe('1:2:3')
  })

  it('should handle deep nesting paths', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Deep Node')
    node.id = toNodeId(99)
    graph.add(node)
    const path = ['1', '2', '3', '4', '5'] as const

    const dto = new ExecutableNodeDTO(node, path, new Map(), undefined)

    expect(dto.id).toBe('1:2:3:4:5:99')
  })

  it('should handle string and number IDs consistently', () => {
    const graph = new LGraph()
    const node1 = new LGraphNode('Node 1')
    node1.id = toNodeId(10)
    graph.add(node1)

    const node2 = new LGraphNode('Node 2')
    node2.id = toNodeId(20)
    graph.add(node2)

    const dto1 = new ExecutableNodeDTO(node1, ['5'], new Map(), undefined)
    const dto2 = new ExecutableNodeDTO(node2, ['5'], new Map(), undefined)

    expect(dto1.id).toBe('5:10')
    expect(dto2.id).toBe('5:20')
  })
})

describe('ExecutableNodeDTO Input Resolution', () => {
  it('should return undefined for unconnected inputs', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    node.addInput('in', 'number')
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    // Unconnected input should return undefined
    const resolved = dto.resolveInput(0)
    expect(resolved).toBeUndefined()
  })

  it('should throw for non-existent input slots', () => {
    const graph = new LGraph()
    const node = new LGraphNode('No Input Node')
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    // Should throw SlotIndexError for non-existent input
    expect(() => dto.resolveInput(0)).toThrow('No input found for flattened id')
  })

  it('should handle subgraph boundary inputs', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'input1', type: 'number' }],
      nodeCount: 1
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    // Get the inner node and create DTO
    const innerNode = subgraph.nodes[0]
    const dto = new ExecutableNodeDTO(innerNode, ['1'], new Map(), subgraphNode)

    // Should return undefined for unconnected input
    const resolved = dto.resolveInput(0)
    expect(resolved).toBeUndefined()
  })
})

describe('ExecutableNodeDTO Output Resolution', () => {
  it('should resolve outputs for simple nodes', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    node.addOutput('out', 'string')
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    // resolveOutput requires type and visited parameters
    const resolved = dto.resolveOutput(0, 'string', new Set())

    expect(resolved).toBeDefined()
    expect(resolved?.node).toBe(dto)
    expect(resolved?.origin_id).toBe(dto.id)
    expect(resolved?.origin_slot).toBe(0)
  })

  it('should resolve cross-boundary outputs in subgraphs', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'output1', type: 'string' }],
      nodeCount: 1
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    // Get the inner node and create DTO
    const innerNode = subgraph.nodes[0]
    const dto = new ExecutableNodeDTO(innerNode, ['1'], new Map(), subgraphNode)

    const resolved = dto.resolveOutput(0, 'string', new Set())

    expect(resolved).toBeDefined()
  })

  it('should handle nodes with no outputs', () => {
    const graph = new LGraph()
    const node = new LGraphNode('No Output Node')
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    // For regular nodes, resolveOutput returns the node itself even if no outputs
    // This tests the current implementation behavior
    const resolved = dto.resolveOutput(0, 'string', new Set())
    expect(resolved).toBeDefined()
    expect(resolved?.node).toBe(dto)
    expect(resolved?.origin_slot).toBe(0)
  })
})

describe('Muted node output resolution', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('should return undefined for NEVER mode nodes', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Muted Node')
    node.addOutput('out', 'string')
    node.mode = LGraphEventMode.NEVER
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)
    const resolved = dto.resolveOutput(0, 'string', new Set())

    expect(resolved).toBeUndefined()
  })

  it('should return undefined for muted subgraph nodes without throwing', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'out', type: 'IMAGE' }],
      nodeCount: 1
    })
    const subgraphNode = createTestSubgraphNode(subgraph)

    subgraphNode.mode = LGraphEventMode.NEVER

    // Empty map simulates executionUtil skipping getInnerNodes() for muted nodes
    const nodesByExecutionId = new Map()
    const dto = new ExecutableNodeDTO(
      subgraphNode,
      [],
      nodesByExecutionId,
      undefined
    )
    nodesByExecutionId.set(dto.id, dto)

    const resolved = dto.resolveOutput(0, 'IMAGE', new Set())
    expect(resolved).toBeUndefined()
  })

  it('should resolve undefined when input is connected to a muted node', () => {
    const graph = new LGraph()

    const mutedNode = new LGraphNode('Muted Node')
    mutedNode.addOutput('result', 'IMAGE')
    mutedNode.mode = LGraphEventMode.NEVER
    graph.add(mutedNode)

    const downstreamNode = new LGraphNode('Downstream')
    downstreamNode.addInput('input', 'IMAGE')
    graph.add(downstreamNode)

    mutedNode.connect(0, downstreamNode, 0)

    const nodeDtoMap = new Map()
    const mutedDto = new ExecutableNodeDTO(mutedNode, [], nodeDtoMap, undefined)
    nodeDtoMap.set(mutedDto.id, mutedDto)

    const downstreamDto = new ExecutableNodeDTO(
      downstreamNode,
      [],
      nodeDtoMap,
      undefined
    )
    nodeDtoMap.set(downstreamDto.id, downstreamDto)

    const resolved = downstreamDto.resolveInput(0)
    expect(resolved).toBeUndefined()
  })
})

describe('Bypass node output resolution', () => {
  it('should still resolve bypass for BYPASS mode nodes', () => {
    const graph = new LGraph()

    const upstreamNode = new LGraphNode('Upstream')
    upstreamNode.addOutput('out', 'IMAGE')
    graph.add(upstreamNode)

    const bypassedNode = new LGraphNode('Bypassed')
    bypassedNode.addInput('in', 'IMAGE')
    bypassedNode.addOutput('out', 'IMAGE')
    bypassedNode.mode = LGraphEventMode.BYPASS
    graph.add(bypassedNode)

    upstreamNode.connect(0, bypassedNode, 0)

    const nodeDtoMap = new Map()
    const upstreamDto = new ExecutableNodeDTO(
      upstreamNode,
      [],
      nodeDtoMap,
      undefined
    )
    nodeDtoMap.set(upstreamDto.id, upstreamDto)

    const bypassedDto = new ExecutableNodeDTO(
      bypassedNode,
      [],
      nodeDtoMap,
      undefined
    )
    nodeDtoMap.set(bypassedDto.id, bypassedDto)

    const resolved = bypassedDto.resolveOutput(0, 'IMAGE', new Set())
    expect(resolved).toBeDefined()
    expect(resolved?.node).toBe(upstreamDto)
  })
})

describe('ALWAYS mode node output resolution', () => {
  it('should attempt normal resolution for ALWAYS mode nodes', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Normal Node')
    node.addOutput('out', 'IMAGE')
    node.mode = LGraphEventMode.ALWAYS
    graph.add(node)

    const nodeDtoMap = new Map()
    const dto = new ExecutableNodeDTO(node, [], nodeDtoMap, undefined)
    nodeDtoMap.set(dto.id, dto)

    const resolved = dto.resolveOutput(0, 'IMAGE', new Set())
    expect(resolved).toBeDefined()
    expect(resolved?.node).toBe(dto)
    expect(resolved?.origin_slot).toBe(0)
  })
})

describe('Virtual node resolveVirtualOutput', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('should resolve through resolveVirtualOutput when implemented', () => {
    const graph = new LGraph()

    const sourceNode = new LGraphNode('Source')
    sourceNode.addOutput('out', 'IMAGE')
    graph.add(sourceNode)

    const virtualNode = new LGraphNode('Virtual Get')
    virtualNode.addOutput('out', 'IMAGE')
    virtualNode.isVirtualNode = true
    virtualNode.resolveVirtualOutput = () => ({ node: sourceNode, slot: 0 })
    graph.add(virtualNode)

    const nodeDtoMap = new Map()
    const sourceDto = new ExecutableNodeDTO(
      sourceNode,
      [],
      nodeDtoMap,
      undefined
    )
    nodeDtoMap.set(sourceDto.id, sourceDto)

    const virtualDto = new ExecutableNodeDTO(
      virtualNode,
      [],
      nodeDtoMap,
      undefined
    )
    nodeDtoMap.set(virtualDto.id, virtualDto)

    const resolved = virtualDto.resolveOutput(0, 'IMAGE', new Set())
    expect(resolved).toBeDefined()
    expect(resolved?.node).toBe(sourceDto)
    expect(resolved?.origin_slot).toBe(0)
  })

  it('should throw when resolveVirtualOutput returns a node with no matching DTO', () => {
    const graph = new LGraph()

    const unmappedNode = new LGraphNode('Unmapped Source')
    unmappedNode.addOutput('out', 'IMAGE')
    graph.add(unmappedNode)

    const virtualNode = new LGraphNode('Virtual Get')
    virtualNode.addOutput('out', 'IMAGE')
    virtualNode.isVirtualNode = true
    virtualNode.resolveVirtualOutput = () => ({
      node: unmappedNode,
      slot: 0
    })
    graph.add(virtualNode)

    const nodeDtoMap = new Map()
    const virtualDto = new ExecutableNodeDTO(
      virtualNode,
      [],
      nodeDtoMap,
      undefined
    )
    nodeDtoMap.set(virtualDto.id, virtualDto)

    expect(() => virtualDto.resolveOutput(0, 'IMAGE', new Set())).toThrow(
      'No DTO found for virtual source node'
    )
  })

  it('should fall through to getInputLink when resolveVirtualOutput returns undefined', () => {
    const graph = new LGraph()

    const virtualNode = new LGraphNode('Virtual Passthrough')
    virtualNode.addOutput('out', 'IMAGE')
    virtualNode.isVirtualNode = true
    virtualNode.resolveVirtualOutput = () => undefined
    graph.add(virtualNode)

    const nodeDtoMap = new Map()
    const virtualDto = new ExecutableNodeDTO(
      virtualNode,
      [],
      nodeDtoMap,
      undefined
    )
    nodeDtoMap.set(virtualDto.id, virtualDto)

    const spy = vi.spyOn(virtualNode, 'getInputLink')
    const resolved = virtualDto.resolveOutput(0, 'IMAGE', new Set())
    expect(resolved).toBeUndefined()
    expect(spy).toHaveBeenCalledWith(0)
  })
})

describe('ExecutableNodeDTO Properties', () => {
  it('should provide access to basic properties', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    node.id = toNodeId(42)
    node.addInput('input', 'number')
    node.addOutput('output', 'string')
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, ['1', '2'], new Map(), undefined)

    expect(dto.id).toBe('1:2:42')
    expect(dto.type).toBe(node.type)
    expect(dto.title).toBe(node.title)
    expect(dto.mode).toBe(node.mode)
    expect(dto.isVirtualNode).toBe(node.isVirtualNode)
  })

  it('should provide access to input information', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    node.addInput('testInput', 'number')
    node.inputs[0].link = toLinkId(999) // Simulate connection
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    expect(dto.inputs).toBeDefined()
    expect(dto.inputs).toHaveLength(1)
    expect(dto.inputs[0].name).toBe('testInput')
    expect(dto.inputs[0].type).toBe('number')
    expect(dto.inputs[0].linkId).toBe(999)
  })
})

describe('ExecutableNodeDTO Memory Efficiency', () => {
  it('should create lightweight objects', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    node.addInput('in1', 'number')
    node.addInput('in2', 'string')
    node.addOutput('out1', 'number')
    node.addOutput('out2', 'string')
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, ['1'], new Map(), undefined)

    // DTO should be lightweight - only essential properties
    expect(dto.node).toBe(node) // Reference, not copy
    expect(dto.subgraphNodePath).toEqual(['1']) // Reference to path
    expect(dto.inputs).toHaveLength(2) // Copied input data only

    // Should not duplicate heavy node data
    // eslint-disable-next-line no-prototype-builtins
    expect(dto.hasOwnProperty('outputs')).toBe(false) // Outputs not copied
    // eslint-disable-next-line no-prototype-builtins
    expect(dto.hasOwnProperty('widgets')).toBe(false) // Widgets not copied
  })

  it('should drop local references without explicit disposal', () => {
    const graph = new LGraph()
    const nodes: ExecutableNodeDTO[] = []

    // Create DTOs
    for (let i = 0; i < 100; i++) {
      const node = new LGraphNode(`Node ${i}`)
      node.id = toNodeId(i)
      graph.add(node)
      const dto = new ExecutableNodeDTO(node, ['parent'], new Map(), undefined)
      nodes.push(dto)
    }

    expect(nodes).toHaveLength(100)

    // Clear references
    nodes.length = 0

    // DTOs should be eligible for garbage collection
    // (No explicit disposal needed - they're lightweight wrappers)
    expect(nodes).toHaveLength(0)
  })

  it('should not retain unnecessary references', () => {
    const subgraph = createTestSubgraph({ nodeCount: 1 })
    const subgraphNode = createTestSubgraphNode(subgraph)
    const innerNode = subgraph.nodes[0]

    const dto = new ExecutableNodeDTO(innerNode, ['1'], new Map(), subgraphNode)

    // Should hold necessary references
    expect(dto.node).toBe(innerNode)
    expect(dto.subgraphNode).toBe(subgraphNode)
    expect(dto.graph).toBe(innerNode.graph)

    // Should not hold heavy references that prevent GC
    // eslint-disable-next-line no-prototype-builtins
    expect(dto.hasOwnProperty('parentGraph')).toBe(false)
    // eslint-disable-next-line no-prototype-builtins
    expect(dto.hasOwnProperty('rootGraph')).toBe(false)
  })
})

describe('ExecutableNodeDTO Integration', () => {
  it('should work with SubgraphNode flattening', () => {
    const subgraph = createTestSubgraph({ nodeCount: 3 })
    const subgraphNode = createTestSubgraphNode(subgraph)

    const flattened = subgraphNode.getInnerNodes(new Map())

    const idPattern = new RegExp(`^${subgraphNode.id}:\\d+$`)
    expect(flattened).toHaveLength(3)
    expect(flattened[0]).toBeInstanceOf(ExecutableNodeDTO)
    expect(flattened[0].id).toMatch(idPattern)
  })

  it('should handle nested subgraph flattening', () => {
    // FIXME: Complex nested structure requires proper parent graph setup
    // This test needs investigation of how resolveSubgraphIdPath works
    // Skip for now - will implement in edge cases test file
    const nested = createNestedSubgraphs({
      depth: 2,
      nodesPerLevel: 1
    })

    const rootSubgraphNode = nested.subgraphNodes[0]
    const executableNodes = new Map()
    const flattened = rootSubgraphNode.getInnerNodes(executableNodes)

    expect(flattened.length).toBeGreaterThan(0)
    const hierarchicalIds = flattened.filter((dto) => dto.id.includes(':'))
    expect(hierarchicalIds.length).toBeGreaterThan(0)
  })

  it('should preserve original node properties through DTO', () => {
    const graph = new LGraph()
    const originalNode = new LGraphNode('Original')
    originalNode.id = toNodeId(123)
    originalNode.addInput('test', 'number')
    originalNode.properties = { value: 42 }
    graph.add(originalNode)

    const dto = new ExecutableNodeDTO(
      originalNode,
      ['parent'],
      new Map(),
      undefined
    )

    // DTO should provide access to original node properties
    expect(Number(dto.node.id)).toBe(123)
    expect(dto.node.inputs).toHaveLength(1)
    expect(dto.node.properties.value).toBe(42)

    // But DTO ID should be path-based
    expect(dto.id).toBe('parent:123')
  })

  it('should handle execution context correctly', () => {
    const subgraph = createTestSubgraph({ nodeCount: 1 })
    const subgraphNode = createTestSubgraphNode(subgraph, { id: 99 })
    const innerNode = subgraph.nodes[0]
    innerNode.id = toNodeId(55)

    const dto = new ExecutableNodeDTO(
      innerNode,
      ['99'],
      new Map(),
      subgraphNode
    )

    // DTO provides execution context
    expect(dto.id).toBe('99:55') // Path-based execution ID
    expect(Number(dto.node.id)).toBe(55) // Original node ID preserved
    expect(Number(dto.subgraphNode?.id)).toBe(99) // Subgraph context
  })
})

describe('ExecutableNodeDTO Scale Testing', () => {
  it('should create DTOs at scale', () => {
    const graph = new LGraph()
    const startTime = performance.now()
    const dtos: ExecutableNodeDTO[] = []

    // Create DTOs to test performance
    for (let i = 0; i < 1000; i++) {
      const node = new LGraphNode(`Node ${i}`)
      node.id = toNodeId(i)
      node.addInput('in', 'number')
      graph.add(node)

      const dto = new ExecutableNodeDTO(node, ['parent'], new Map(), undefined)
      dtos.push(dto)
    }

    const endTime = performance.now()
    const duration = endTime - startTime

    expect(dtos).toHaveLength(1000)
    // Test deterministic properties instead of flaky timing
    expect(dtos[0].id).toBe('parent:0')
    expect(dtos[999].id).toBe('parent:999')
    expect(dtos.every((dto, i) => dto.id === `parent:${i}`)).toBe(true)

    console.log(`Created 1000 DTOs in ${duration.toFixed(2)}ms`)
  })

  it('should handle complex path generation correctly', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Deep Node')
    node.id = toNodeId(999)
    graph.add(node)

    // Test deterministic path generation behavior
    const testCases = [
      { depth: 1, expectedId: '1:999' },
      { depth: 3, expectedId: '1:2:3:999' },
      { depth: 5, expectedId: '1:2:3:4:5:999' },
      { depth: 10, expectedId: '1:2:3:4:5:6:7:8:9:10:999' }
    ]

    for (const testCase of testCases) {
      const path = Array.from({ length: testCase.depth }, (_, i) =>
        (i + 1).toString()
      )
      const dto = new ExecutableNodeDTO(node, path, new Map(), undefined)
      expect(dto.id).toBe(testCase.expectedId)
    }
  })
})

describe('ExecutableNodeDTO error and edge branches', () => {
  it('throws NullGraphError when the node has no graph', () => {
    const orphan = new LGraphNode('Orphan')

    expect(() => new ExecutableNodeDTO(orphan, [], new Map())).toThrow(
      NullGraphError
    )
  })

  it('returns itself from getInnerNodes for regular nodes', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Plain')
    graph.add(node)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    expect(dto.getInnerNodes()).toEqual([dto])
  })

  it('throws InvalidLinkError for dangling input link ids', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Dangling')
    node.addInput('in', 'IMAGE')
    graph.add(node)
    node.inputs[0].link = toLinkId(999)

    const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)

    expect(() => dto.resolveInput(0)).toThrow('No link found in parent graph')
  })

  function createBypassCycle() {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    a.addInput('in', 'IMAGE')
    a.addOutput('out', 'IMAGE')
    a.mode = LGraphEventMode.BYPASS
    const b = new LGraphNode('B')
    b.addInput('in', 'IMAGE')
    b.addOutput('out', 'IMAGE')
    b.mode = LGraphEventMode.BYPASS
    graph.add(a)
    graph.add(b)
    a.connect(0, b, 0)
    b.connect(0, a, 0)

    const map = new Map()
    const dtoA = new ExecutableNodeDTO(a, [], map, undefined)
    const dtoB = new ExecutableNodeDTO(b, [], map, undefined)
    map.set(dtoA.id, dtoA)
    map.set(dtoB.id, dtoB)
    return { dtoA }
  }

  it('throws a RecursionError when input resolution loops', () => {
    const { dtoA } = createBypassCycle()

    expect(() => dtoA.resolveInput(0)).toThrow('Circular reference detected')
  })

  it('throws a RecursionError when output resolution loops', () => {
    const { dtoA } = createBypassCycle()

    expect(() => dtoA.resolveOutput(0, 'IMAGE', new Set())).toThrow(
      'Circular reference detected'
    )
  })

  it('includes the subgraph path in recursion errors', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    a.addInput('in', 'IMAGE')
    a.addOutput('out', 'IMAGE')
    a.mode = LGraphEventMode.BYPASS
    const b = new LGraphNode('B')
    b.addInput('in', 'IMAGE')
    b.addOutput('out', 'IMAGE')
    b.mode = LGraphEventMode.BYPASS
    graph.add(a)
    graph.add(b)
    a.connect(0, b, 0)
    b.connect(0, a, 0)

    const map = new Map()
    const dtoA = new ExecutableNodeDTO(a, ['7'], map, undefined)
    const dtoB = new ExecutableNodeDTO(b, ['7'], map, undefined)
    map.set(dtoA.id, dtoA)
    map.set(dtoB.id, dtoB)

    expect(() => dtoA.resolveInput(0)).toThrow('at path 7')
  })

  describe('subgraph boundary resolution', () => {
    function createBoundarySetup(options: { connectOuter?: boolean } = {}) {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'value', type: 'IMAGE' }],
        outputs: [{ name: 'result', type: 'IMAGE' }]
      })
      const inner = new LGraphNode('Inner')
      inner.addInput('in', 'IMAGE')
      inner.addOutput('out', 'IMAGE')
      subgraph.add(inner)
      subgraph.inputs[0].connect(inner.inputs[0], inner)
      subgraph.outputs[0].connect(inner.outputs[0], inner)

      const subgraphNode = createTestSubgraphNode(subgraph)
      subgraph.rootGraph.add(subgraphNode)

      // DTOs snapshot their input links, so wire the outer graph first.
      let outer: LGraphNode | undefined
      if (options.connectOuter) {
        outer = new LGraphNode('Outer')
        outer.addOutput('out', 'IMAGE')
        subgraph.rootGraph.add(outer)
        outer.connect(0, subgraphNode, 0)
      }

      const map = new Map()
      if (outer) {
        const outerDto = new ExecutableNodeDTO(outer, [], map)
        map.set(outerDto.id, outerDto)
      }
      const subgraphNodeDto = new ExecutableNodeDTO(subgraphNode, [], map)
      map.set(subgraphNodeDto.id, subgraphNodeDto)
      const innerDto = new ExecutableNodeDTO(
        inner,
        [String(subgraphNode.id)],
        map,
        subgraphNode
      )
      map.set(innerDto.id, innerDto)

      return {
        subgraph,
        inner,
        outer,
        subgraphNode,
        map,
        subgraphNodeDto,
        innerDto
      }
    }

    it('resolves inner node inputs through to the outer graph', () => {
      const { outer, innerDto } = createBoundarySetup({ connectOuter: true })

      const resolved = innerDto.resolveInput(0)

      expect(resolved?.origin_id).toBe(String(outer!.id))
      expect(resolved?.origin_slot).toBe(0)
    })

    it('returns undefined for unconnected subgraph inputs without widgets', () => {
      const { innerDto } = createBoundarySetup()

      expect(innerDto.resolveInput(0)).toBeUndefined()
    })

    it('returns the promoted widget value for widget-backed subgraph inputs', () => {
      const { subgraphNode, innerDto } = createBoundarySetup()
      subgraphNode.inputs[0].widgetId = widgetId(
        subgraphNode.graph!.id,
        subgraphNode.id,
        'value'
      )

      const resolved = innerDto.resolveInput(0)

      expect(resolved?.origin_slot).toBe(-1)
      expect(resolved?.widgetInfo).toBeDefined()
      expect(resolved?.origin_id).toBe(innerDto.id)
    })

    it('throws SlotIndexError when the subgraph node lacks the input slot', () => {
      const { subgraphNode, innerDto } = createBoundarySetup()
      // Characterises corruption handling: the subgraph node lost its slots.
      subgraphNode.inputs.length = 0

      expect(() => innerDto.resolveInput(0)).toThrow('No input found for slot')
    })

    it('resolves subgraph node outputs through the inner node', () => {
      const { inner, subgraphNode, subgraphNodeDto } = createBoundarySetup()

      const resolved = subgraphNodeDto.resolveOutput(0, 'IMAGE', new Set())

      expect(resolved?.origin_id).toBe(`${subgraphNode.id}:${inner.id}`)
      expect(resolved?.origin_slot).toBe(0)
    })

    it('throws SlotIndexError for missing subgraph output slots', () => {
      const { subgraphNodeDto } = createBoundarySetup()

      expect(() =>
        subgraphNodeDto.resolveOutput(5, 'IMAGE', new Set())
      ).toThrow('No output found for flattened id')
    })

    it('returns undefined when the subgraph output has no internal link', () => {
      const subgraph = createTestSubgraph({
        outputs: [{ name: 'result', type: 'IMAGE' }]
      })
      const subgraphNode = createTestSubgraphNode(subgraph)
      subgraph.rootGraph.add(subgraphNode)
      const map = new Map()
      const dto = new ExecutableNodeDTO(subgraphNode, [], map)
      map.set(dto.id, dto)

      expect(dto.resolveOutput(0, 'IMAGE', new Set())).toBeUndefined()
    })
  })

  describe('bypass slot matching', () => {
    it('matches by slot index for wildcard target types', () => {
      const graph = new LGraph()
      const node = new LGraphNode('Bypass')
      node.addInput('in', 'IMAGE')
      node.addOutput('out0', 'IMAGE')
      node.addOutput('out1', 'IMAGE')
      node.mode = LGraphEventMode.BYPASS
      graph.add(node)

      const map = new Map()
      const dto = new ExecutableNodeDTO(node, [], map)
      map.set(dto.id, dto)

      // Both resolve through unconnected inputs, so the result is undefined,
      // but neither is rejected as a failed type match.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(dto.resolveOutput(0, '*', new Set())).toBeUndefined()
      expect(dto.resolveOutput(1, '*', new Set())).toBeUndefined()
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('prefers an exact type match over the opposite slot index', () => {
      const graph = new LGraph()
      const source = new LGraphNode('Source')
      source.addOutput('mask', 'MASK')
      const node = new LGraphNode('Bypass')
      node.addInput('image', 'IMAGE')
      node.addInput('mask', 'MASK')
      node.addOutput('mask', 'MASK')
      node.mode = LGraphEventMode.BYPASS
      graph.add(source)
      graph.add(node)
      source.connect(0, node, 1)

      const map = new Map()
      const sourceDto = new ExecutableNodeDTO(source, [], map)
      map.set(sourceDto.id, sourceDto)
      const dto = new ExecutableNodeDTO(node, [], map)
      map.set(dto.id, dto)

      const resolved = dto.resolveOutput(0, 'MASK', new Set())

      expect(resolved?.origin_id).toBe(String(source.id))
    })

    it('warns and returns undefined when no input type matches', () => {
      const graph = new LGraph()
      const node = new LGraphNode('Bypass')
      node.addInput('in', 'IMAGE')
      node.addOutput('out', 'IMAGE')
      node.mode = LGraphEventMode.BYPASS
      graph.add(node)

      const map = new Map()
      const dto = new ExecutableNodeDTO(node, [], map)
      map.set(dto.id, dto)

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(dto.resolveOutput(0, 'MASK', new Set())).toBeUndefined()
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  it('resolves virtual nodes through their input link', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'IMAGE')
    const virtualNode = new LGraphNode('Virtual Passthrough')
    virtualNode.addInput('in', 'IMAGE')
    virtualNode.addOutput('out', 'IMAGE')
    virtualNode.isVirtualNode = true
    graph.add(source)
    graph.add(virtualNode)
    source.connect(0, virtualNode, 0)

    const map = new Map()
    const sourceDto = new ExecutableNodeDTO(source, [], map)
    map.set(sourceDto.id, sourceDto)
    const virtualDto = new ExecutableNodeDTO(virtualNode, [], map)
    map.set(virtualDto.id, virtualDto)

    const resolved = virtualDto.resolveOutput(0, 'IMAGE', new Set())

    expect(resolved?.origin_id).toBe(String(source.id))
    expect(resolved?.origin_slot).toBe(0)
  })
})

describe('ExecutableNodeDTO missing DTO map entries', () => {
  it('throws when the upstream node DTO is missing from the map', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'IMAGE')
    const target = new LGraphNode('Target')
    target.addInput('in', 'IMAGE')
    graph.add(source)
    graph.add(target)
    source.connect(0, target, 0)

    const map = new Map()
    const dto = new ExecutableNodeDTO(target, [], map)
    map.set(dto.id, dto)

    expect(() => dto.resolveInput(0)).toThrow('No output node DTO found')
  })

  it('throws when the containing subgraph node DTO is missing from the map', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'IMAGE' }]
    })
    const inner = new LGraphNode('Inner')
    inner.addInput('in', 'IMAGE')
    subgraph.add(inner)
    subgraph.inputs[0].connect(inner.inputs[0], inner)
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraph.rootGraph.add(subgraphNode)
    const outer = new LGraphNode('Outer')
    outer.addOutput('out', 'IMAGE')
    subgraph.rootGraph.add(outer)
    outer.connect(0, subgraphNode, 0)

    const map = new Map()
    const innerDto = new ExecutableNodeDTO(
      inner,
      [String(subgraphNode.id)],
      map,
      subgraphNode
    )
    map.set(innerDto.id, innerDto)

    expect(() => innerDto.resolveInput(0)).toThrow('No subgraph node DTO found')
  })

  it('throws when a virtual node input DTO is missing from the map', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'IMAGE')
    const virtualNode = new LGraphNode('Virtual')
    virtualNode.addInput('in', 'IMAGE')
    virtualNode.addOutput('out', 'IMAGE')
    virtualNode.isVirtualNode = true
    graph.add(source)
    graph.add(virtualNode)
    source.connect(0, virtualNode, 0)

    // The virtual node resolves through its own input, whose DTO is missing.
    const map = new Map()
    const virtualDto = new ExecutableNodeDTO(virtualNode, [], map)

    expect(() => virtualDto.resolveOutput(0, 'IMAGE', new Set())).toThrow(
      'No input node DTO found'
    )
  })
})
