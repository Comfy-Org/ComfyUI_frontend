import { describe, expect, it } from 'vitest'

import { promptBuildErrorFingerprint } from '@/utils/promptBuildErrorFingerprint'

describe('promptBuildErrorFingerprint', () => {
  it('groups missing output nodes across ids, slots and output names', () => {
    const first = new Error('No output node found for id [632] slot [0] images')
    const second = new Error('No output node found for id [12:7] slot [3] mask')

    expect(promptBuildErrorFingerprint(first)).toEqual(
      promptBuildErrorFingerprint(second)
    )
  })

  it('keeps different failure kinds apart', () => {
    const missingOutput = new Error(
      'No output node found for id [1] slot [0] x'
    )
    const missingInput = new TypeError(
      'No input found for flattened id [1] slot [0]'
    )

    expect(promptBuildErrorFingerprint(missingOutput)).not.toEqual(
      promptBuildErrorFingerprint(missingInput)
    )
  })

  it.for([
    {
      thrower: 'ExecutableNodeDTO.resolveInput',
      suffix: ' during input resolution'
    },
    { thrower: 'SubgraphNode.rootGraph', suffix: '' }
  ])(
    'groups NullGraphError across numeric and string subgraph node ids ($thrower)',
    ({ suffix }) => {
      function nullGraphError(nodeId: string) {
        const error = new Error(`SubgraphNode ${nodeId} has no graph${suffix}`)
        error.name = 'NullGraphError'
        return error
      }

      expect(promptBuildErrorFingerprint(nullGraphError('alpha'))).toEqual([
        'error_building_prompt',
        'NullGraphError',
        `SubgraphNode N has no graph${suffix}`
      ])
      expect(promptBuildErrorFingerprint(nullGraphError('beta'))).toEqual(
        promptBuildErrorFingerprint(nullGraphError('alpha'))
      )
      expect(promptBuildErrorFingerprint(nullGraphError('42'))).toEqual(
        promptBuildErrorFingerprint(nullGraphError('alpha'))
      )
    }
  )

  it('keeps the two NullGraphError sites apart', () => {
    const duringInput = new Error(
      'SubgraphNode alpha has no graph during input resolution'
    )
    const rootGraph = new Error('SubgraphNode alpha has no graph')

    expect(promptBuildErrorFingerprint(duringInput)).not.toEqual(
      promptBuildErrorFingerprint(rootGraph)
    )
  })

  it('groups subgraph hierarchy recursion errors across ids, titles, names and depths', () => {
    function hierarchyRecursionError(
      depth: number,
      nodeInfo: string,
      subgraphName: string
    ) {
      const error = new Error(
        `Circular reference detected at depth ${depth} in node ${nodeInfo} of subgraph '${subgraphName}'. ` +
          `This creates an infinite loop in the subgraph hierarchy.`
      )
      error.name = 'RecursionError'
      return error
    }

    expect(
      promptBuildErrorFingerprint(
        hierarchyRecursionError(2, 'alpha (Load. Image)', 'Detailer')
      )
    ).toEqual(
      promptBuildErrorFingerprint(
        hierarchyRecursionError(3, 'beta', 'Unnamed Subgraph')
      )
    )
  })

  it.for([
    { direction: 'input', path: '' },
    { direction: 'output', path: ' at path sub-a:sub-b' }
  ])(
    'groups recursion errors across string node ids, titles and paths ($direction)',
    ({ direction, path }) => {
      function recursionError(nodeInfo: string, uniqueId: string) {
        const error = new Error(
          `Circular reference detected while resolving ${direction} 0 of node ${nodeInfo}${path}. ` +
            `This creates an infinite loop in link resolution. UniqueID: [${uniqueId}]`
        )
        error.name = 'RecursionError'
        return error
      }

      expect(
        promptBuildErrorFingerprint(
          recursionError('alpha (Load. Image)', 'x:alpha[I]0')
        )
      ).toEqual(
        promptBuildErrorFingerprint(recursionError('beta', 'y:beta[I]0'))
      )
    }
  )

  it('groups errors that end with a string node id', () => {
    expect(
      promptBuildErrorFingerprint(
        new TypeError('Node is not a subgraph node: alpha')
      )
    ).toEqual(
      promptBuildErrorFingerprint(
        new TypeError('Node is not a subgraph node: beta')
      )
    )
  })

  it('uses the error name for values that are not errors', () => {
    expect(promptBuildErrorFingerprint('boom 12')).toEqual([
      'error_building_prompt',
      'Error',
      'boom N'
    ])
  })
})
