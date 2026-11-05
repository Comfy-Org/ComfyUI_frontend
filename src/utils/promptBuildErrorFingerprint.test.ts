import { describe, expect, it } from 'vitest'

import { promptBuildErrorFingerprint } from '@/utils/promptBuildErrorFingerprint'

describe('promptBuildErrorFingerprint', () => {
  it('groups the same failure across different node ids', () => {
    const first = new Error('No output node found for id [632] slot [0] images')
    const second = new Error(
      'No output node found for id [12:7] slot [3] images'
    )

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

  it('strips bare numeric ids outside brackets', () => {
    expect(
      promptBuildErrorFingerprint(new Error('Node 42 has no graph'))
    ).toEqual(['error_building_prompt', 'Error', 'Node N has no graph'])
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
