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

  it('uses the error name for values that are not errors', () => {
    expect(promptBuildErrorFingerprint('boom 12')).toEqual([
      'error_building_prompt',
      'Error',
      'boom N'
    ])
  })
})
