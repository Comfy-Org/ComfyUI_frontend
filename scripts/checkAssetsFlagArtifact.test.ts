import { describe, expect, it } from 'vitest'

import { assertAssetsDefaultDisabled } from './checkAssetsFlagArtifact'

describe('assertAssetsDefaultDisabled', () => {
  it('accepts a build that delegates to the opt-in Assets flag', () => {
    expect(() =>
      assertAssetsDefaultDisabled([
        'get assetsEnabled() {\n  return resolveFlag("assets", void 0, false);\n}'
      ])
    ).not.toThrow()
  })

  it('rejects a build that enables Assets unconditionally', () => {
    expect(() =>
      assertAssetsDefaultDisabled(['get assetsEnabled() {\n  return true;\n}'])
    ).toThrow('Built Assets flag does not default off')
  })

  it('rejects a build without exactly one flag getter', () => {
    expect(() => assertAssetsDefaultDisabled([])).toThrow(
      'Expected one assetsEnabled getter in the build, found 0'
    )
  })
})
