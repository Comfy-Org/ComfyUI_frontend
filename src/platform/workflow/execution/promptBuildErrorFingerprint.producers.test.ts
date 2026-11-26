import { assert, beforeEach, describe, expect, it } from 'vitest'

import type { SerializedNodeId } from '@comfyorg/graph-model/nodeId'
import type {
  ExecutableLGraphNode,
  ExecutionId
} from '@comfyorg/litegraph/litegraph'
import {
  ExecutableNodeDTO,
  LGraph,
  LGraphEventMode,
  LGraphNode
} from '@comfyorg/litegraph/litegraph'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@comfyorg/litegraph/subgraph/__fixtures__/subgraphHelpers'

import { promptBuildErrorFingerprint } from './promptBuildErrorFingerprint'

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

  it('groups missing parent links across ids and input names', () => {
    function missingParentLink(nodeId: number, inputName: string) {
      const graph = new LGraph()
      const node = new LGraphNode('Resize')
      node.id = toNodeId(nodeId)
      node.addInput(inputName, 'INT')
      graph.add(node)
      const origin = new LGraphNode('Source')
      origin.addOutput('out', 'INT')
      graph.add(origin)
      const link = origin.connect(0, node, 0)
      assert.exists(link)
      const dto = new ExecutableNodeDTO(node, [], new Map())
      graph.removeLink(link.id)
      return fingerprintOfThrow(() => dto.resolveInput(0))
    }

    const namedInput = missingParentLink(7, 'width')
    expect(namedInput).toEqual([
      'error_building_prompt',
      'InvalidLinkError',
      'No link found in parent graph for id [] slot []'
    ])
    expect(missingParentLink(632, 'height')).toEqual(namedInput)
    expect(missingParentLink(9, '')).toEqual(namedInput)
  })

  it('groups recursion across node identities and instance paths but keeps input and output apart', () => {
    function connectedBypassCycle(
      nodeId: SerializedNodeId,
      title: string,
      instancePath: readonly SerializedNodeId[] = []
    ) {
      const graph = new LGraph()

      const nodeA = new LGraphNode(title)
      nodeA.id = toNodeId(nodeId)
      nodeA.addInput('in', 'INT')
      nodeA.addOutput('out', 'INT')
      nodeA.mode = LGraphEventMode.BYPASS
      graph.add(nodeA)

      const nodeB = new LGraphNode('Partner')
      nodeB.id = toNodeId(`${nodeId}-partner`)
      nodeB.addInput('in', 'INT')
      nodeB.addOutput('out', 'INT')
      nodeB.mode = LGraphEventMode.BYPASS
      graph.add(nodeB)

      nodeA.connect(0, nodeB, 0)
      nodeB.connect(0, nodeA, 0)

      const nodesByExecutionId = new Map<ExecutionId, ExecutableLGraphNode>()
      const dtoA = new ExecutableNodeDTO(
        nodeA,
        instancePath,
        nodesByExecutionId
      )
      const dtoB = new ExecutableNodeDTO(
        nodeB,
        instancePath,
        nodesByExecutionId
      )
      nodesByExecutionId.set(dtoA.id, dtoA)
      nodesByExecutionId.set(dtoB.id, dtoB)

      return dtoA
    }

    function inputRecursion(nodeId: number, title: string) {
      const dtoA = connectedBypassCycle(nodeId, title)
      return fingerprintOfThrow(() => dtoA.resolveInput(0))
    }
    function outputRecursion(node: ExecutableNodeDTO) {
      return fingerprintOfThrow(() => node.resolveOutput(0, 'INT', new Set()))
    }

    expect(inputRecursion(3, 'Load. Image')).toEqual([
      'error_building_prompt',
      'RecursionError',
      'Circular reference detected while resolving input N of node N'
    ])
    expect(inputRecursion(41, 'Upscale')).toEqual(
      inputRecursion(3, 'Load. Image')
    )
    const numericOutput = outputRecursion(
      connectedBypassCycle(3, 'Load. Image')
    )
    expect(numericOutput).toEqual([
      'error_building_prompt',
      'RecursionError',
      'Circular reference detected while resolving output N of node N'
    ])
    expect(
      outputRecursion(
        connectedBypassCycle('alpha', 'Upscale', ['outer', 'inner'])
      )
    ).toEqual(numericOutput)
  })
})
