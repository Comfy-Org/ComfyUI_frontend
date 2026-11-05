import { beforeEach, describe, expect, it } from 'vitest'

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
})
