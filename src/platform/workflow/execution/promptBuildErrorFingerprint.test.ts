import { describe, expect, it } from 'vitest'

import { promptBuildErrorFingerprint } from './promptBuildErrorFingerprint'

describe('promptBuildErrorFingerprint', () => {
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
