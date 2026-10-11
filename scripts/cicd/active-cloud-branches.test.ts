import { describe, expect, it } from 'vitest'

import { activeCloudBranches } from './active-cloud-branches'

describe('activeCloudBranches', () => {
  const branches = ['cloud/1.9', 'cloud/1.55', 'cloud/1.56', 'cloud/preview']

  it.for([
    [{ testcloudBranch: 'cloud/1.55' }, ['cloud/1.55', 'cloud/1.56']],
    [{ testcloudBranch: 'cloud/1.56' }, ['cloud/1.56']],
    [{ testcloudBranch: 'main' }, ['cloud/1.56']],
    [{ releaseBranch: 'cloud/1.55' }, ['cloud/1.55', 'cloud/1.56']],
    [
      { testcloudBranch: 'cloud/1.56', releaseBranch: 'cloud/1.55' },
      ['cloud/1.56']
    ]
  ])(
    'maintains the newest line and the effective QA line: %j',
    ([config, expected]) => {
      expect(activeCloudBranches(branches, config)).toEqual(expected)
    }
  )

  it.for([
    null,
    {},
    { testcloudBranch: '' },
    { testcloudBranch: 'feature/test' },
    { testcloudBranch: 'cloud/1.54' }
  ])(
    'fails instead of silently abandoning QA when config is invalid: %j',
    (config) => {
      expect(() => activeCloudBranches(branches, config)).toThrow()
    }
  )

  it('requires an existing cloud line', () => {
    expect(() =>
      activeCloudBranches(['main'], { testcloudBranch: 'main' })
    ).toThrow('No cloud release branch exists')
  })
})
