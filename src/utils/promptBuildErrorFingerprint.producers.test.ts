import { assert, beforeEach, describe, expect, it } from 'vitest'

import {
  ExecutableNodeDTO,
  LGraph,
  LGraphEventMode,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { promptBuildErrorFingerprint } from '@/utils/promptBuildErrorFingerprint'

describe('promptBuildErrorFingerprint on real prompt build throwers', () => {
  beforeEach(() => {
    resetSubgraphFixtureState()
  })

  function fingerprintOfThrow(run: () => void): string[] {
    try {
      run()
    } catch (error) {
      return promptBuildErrorFingerprint(error)
    }
    throw new Error('expected the prompt build thrower to throw')
  }

  it('groups SubgraphNode.rootGraph NullGraphError across string node ids', () => {
    function detachedRootGraphAccess(nodeId: string) {
      const subgraphNode = createTestSubgraphNode(createTestSubgraph(), {
        id: nodeId
      })
      subgraphNode.graph = null
      return fingerprintOfThrow(() => subgraphNode.rootGraph)
    }

    expect(detachedRootGraphAccess('alpha')).toEqual([
      'error_building_prompt',
      'NullGraphError',
      'SubgraphNode N has no graph'
    ])
    expect(detachedRootGraphAccess('beta')).toEqual(
      detachedRootGraphAccess('alpha')
    )
  })

  it('groups SubgraphNode.getInnerNodes RecursionError across ids, titles and subgraph names', () => {
    function selfVisitingInnerNodes(
      nodeId: string,
      title: string,
      subgraphName: string
    ) {
      const subgraphNode = createTestSubgraphNode(
        createTestSubgraph({ name: subgraphName }),
        { id: nodeId }
      )
      subgraphNode.title = title
      return fingerprintOfThrow(() =>
        subgraphNode.getInnerNodes(new Map(), [], [], new Set([subgraphNode]))
      )
    }

    expect(selfVisitingInnerNodes('alpha', 'Load. Image', 'Detailer')).toEqual([
      'error_building_prompt',
      'RecursionError',
      'Circular reference detected at depth N in node N of subgraph N'
    ])
    expect(selfVisitingInnerNodes('beta', 'Upscale', 'Refiner')).toEqual(
      selfVisitingInnerNodes('alpha', 'Load. Image', 'Detailer')
    )
    expect(
      selfVisitingInnerNodes('gamma', 'Load of node Image', 'Enhancer')
    ).toEqual(selfVisitingInnerNodes('alpha', 'Load. Image', 'Detailer'))
  })

  function dtoFor(nodeId: number, title: string, inputName = 'value') {
    const graph = new LGraph()
    const node = new LGraphNode(title)
    node.id = toNodeId(nodeId)
    node.addInput(inputName, 'INT')
    node.addOutput('out', 'INT')
    graph.add(node)
    return {
      node,
      graph,
      dto: new ExecutableNodeDTO(node, [], new Map(), undefined)
    }
  }

  it('groups ExecutableNodeDTO.resolveInput missing parent links across ids, slots and input names', () => {
    function missingParentLink(nodeId: number, inputName: string) {
      const { node, graph } = dtoFor(nodeId, 'Resize', inputName)
      const origin = new LGraphNode('Source')
      origin.addOutput('out', 'INT')
      graph.add(origin)
      const link = origin.connect(0, node, 0)
      assert.exists(link)
      const dto = new ExecutableNodeDTO(node, [], new Map(), undefined)
      graph.removeLink(link.id)
      return fingerprintOfThrow(() => dto.resolveInput(0))
    }

    expect(missingParentLink(7, 'width')).toEqual([
      'error_building_prompt',
      'InvalidLinkError',
      'No link found in parent graph for id [] slot []'
    ])
    expect(missingParentLink(632, 'height')).toEqual(
      missingParentLink(7, 'width')
    )
    expect(missingParentLink(9, '')).toEqual(missingParentLink(7, 'width'))
  })

  it('groups ExecutableNodeDTO recursion errors across ids and titles but keeps input and output apart', () => {
    // Two BYPASS nodes wired into each other's slot 0 so that resolving one
    // side's input/output genuinely re-enters the same slot through the
    // other node, instead of pre-seeding the private visited-key encoding.
    function connectedBypassCycle(nodeId: number, title: string) {
      const graph = new LGraph()

      const nodeA = new LGraphNode(title)
      nodeA.id = toNodeId(nodeId)
      nodeA.addInput('in', 'INT')
      nodeA.addOutput('out', 'INT')
      nodeA.mode = LGraphEventMode.BYPASS
      graph.add(nodeA)

      const nodeB = new LGraphNode('Partner')
      nodeB.id = toNodeId(nodeId + 1000)
      nodeB.addInput('in', 'INT')
      nodeB.addOutput('out', 'INT')
      nodeB.mode = LGraphEventMode.BYPASS
      graph.add(nodeB)

      nodeA.connect(0, nodeB, 0)
      nodeB.connect(0, nodeA, 0)

      const nodesByExecutionId = new Map()
      const dtoA = new ExecutableNodeDTO(
        nodeA,
        [],
        nodesByExecutionId,
        undefined
      )
      const dtoB = new ExecutableNodeDTO(
        nodeB,
        [],
        nodesByExecutionId,
        undefined
      )
      nodesByExecutionId.set(dtoA.id, dtoA)
      nodesByExecutionId.set(dtoB.id, dtoB)

      return dtoA
    }

    function inputRecursion(nodeId: number, title: string) {
      const dtoA = connectedBypassCycle(nodeId, title)
      return fingerprintOfThrow(() => dtoA.resolveInput(0))
    }
    function outputRecursion(nodeId: number, title: string) {
      const dtoA = connectedBypassCycle(nodeId, title)
      return fingerprintOfThrow(() => dtoA.resolveOutput(0, 'INT', new Set()))
    }

    expect(inputRecursion(3, 'Load. Image')).toEqual([
      'error_building_prompt',
      'RecursionError',
      'Circular reference detected while resolving input N of node N'
    ])
    expect(inputRecursion(41, 'Upscale')).toEqual(
      inputRecursion(3, 'Load. Image')
    )
    expect(outputRecursion(3, 'Load. Image')).toEqual([
      'error_building_prompt',
      'RecursionError',
      'Circular reference detected while resolving output N of node N'
    ])
    expect(outputRecursion(41, 'Upscale')).toEqual(
      outputRecursion(3, 'Load. Image')
    )
  })

  it('fingerprints the ExecutableNodeDTO NullGraphError without node identity', () => {
    function detachedNodeDto(nodeId: number) {
      const node = new LGraphNode('Detached')
      node.id = toNodeId(nodeId)
      return fingerprintOfThrow(
        () => new ExecutableNodeDTO(node, [], new Map(), undefined)
      )
    }

    expect(detachedNodeDto(5)).toEqual([
      'error_building_prompt',
      'NullGraphError',
      'Attempted to access LGraph reference that was null or undefined.'
    ])
  })
})
