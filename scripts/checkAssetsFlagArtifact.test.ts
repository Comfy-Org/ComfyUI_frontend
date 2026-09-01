import { describe, expect, it } from 'vitest'

import {
  assertAssetApiGate,
  assertBuildProvenance,
  assertNoTestFixtures
} from './checkAssetsFlagArtifact'

describe('assertAssetApiGate', () => {
  it.for(['localhost', 'desktop'])(
    'accepts a disabled %s Asset API gate',
    (distribution) => {
      expect(() =>
        assertAssetApiGate(
          ['function isAssetAPIEnabled() {\n  return false;\n}'],
          distribution
        )
      ).not.toThrow()
    }
  )

  it.for(['localhost', 'desktop'])(
    'accepts a compact disabled %s gate',
    (distribution) => {
      expect(() =>
        assertAssetApiGate(['function isAssetAPIEnabled(){return!1}'], distribution)
      ).not.toThrow()
    }
  )

  it('accepts a Cloud gate controlled by the opt-in setting', () => {
    expect(() =>
      assertAssetApiGate(
        [
          'function isAssetAPIEnabled() {\n  return !!useSettingStore().get("Comfy.Assets.UseAssetAPI");\n}'
        ],
        'cloud'
      )
    ).not.toThrow()
  })

  it('rejects a localhost artifact that still carries the Cloud setting gate', () => {
    expect(() =>
      assertAssetApiGate(
        [
          'function isAssetAPIEnabled() {\n  if (!isCloud) return false;\n  return !!useSettingStore().get("Comfy.Assets.UseAssetAPI");\n}'
        ],
        'localhost'
      )
    ).toThrow('Built Asset API gate is invalid for localhost')
  })

  it('rejects a Cloud build that enables the Asset API unconditionally', () => {
    expect(() =>
      assertAssetApiGate(
        ['function isAssetAPIEnabled() {\n  return true;\n}'],
        'cloud'
      )
    ).toThrow('Built Asset API gate is invalid for cloud')
  })

  it('rejects a build without exactly one Asset API gate', () => {
    expect(() => assertAssetApiGate([], 'localhost')).toThrow(
      'Expected one Asset API gate in the build, found 0'
    )
  })

  it('parses a gate with a nested block through its matching brace', () => {
    expect(() =>
      assertAssetApiGate(
        [
          'function isAssetAPIEnabled() {\n  if (!isCloud) {\n    return false\n  }\n  return !!useSettingStore().get("Comfy.Assets.UseAssetAPI")\n}'
        ],
        'cloud'
      )
    ).not.toThrow()
  })
})

describe('assertBuildProvenance', () => {
  const commit = '0123456789abcdef0123456789abcdef01234567'

  it('accepts the exact source revision embedded in the artifact', () => {
    expect(() =>
      assertBuildProvenance(
        JSON.stringify({ commit, distribution: 'desktop' }),
        commit,
        'desktop'
      )
    ).not.toThrow()
  })

  it('rejects an artifact built from another revision', () => {
    expect(() =>
      assertBuildProvenance(
        JSON.stringify({ commit: 'old', distribution: 'desktop' }),
        commit,
        'desktop'
      )
    ).toThrow(`Build does not contain expected frontend commit ${commit}`)
  })

  it('rejects an artifact built for another distribution', () => {
    expect(() =>
      assertBuildProvenance(
        JSON.stringify({ commit, distribution: 'cloud' }),
        commit,
        'desktop'
      )
    ).toThrow('Build distribution is cloud, expected desktop')
  })

  it.for(['null', '[]', '"invalid"'])(
    'rejects a non-object manifest: %s',
    (manifest) => {
      expect(() => assertBuildProvenance(manifest, commit, 'desktop')).toThrow(
        'Build manifest must be a JSON object'
      )
    }
  )

  it('rejects malformed JSON manifests', () => {
    expect(() => assertBuildProvenance('{', commit, 'desktop')).toThrow()
  })

  it.for([
    JSON.stringify({ distribution: 'desktop' }),
    JSON.stringify({ commit })
  ])('rejects manifests missing a required field: %s', (manifest) => {
    expect(() => assertBuildProvenance(manifest, commit, 'desktop')).toThrow()
  })
})

describe('assertNoTestFixtures', () => {
  it('accepts production chunks', () => {
    expect(() =>
      assertNoTestFixtures(['const endpoint="/api/assets"'])
    ).not.toThrow()
  })

  it.for([
    ['browser_tests/fixtures/assets', 'browser_tests/fixtures/'],
    ['/__fixtures__/asset', '/__fixtures__/'],
    [
      'COMFY_PRODUCTION_FORBIDDEN_MOCK_ASSET_SENTINEL',
      'COMFY_PRODUCTION_FORBIDDEN_MOCK_ASSET_SENTINEL'
    ]
  ])('rejects leaked test marker %s', ([chunkMarker, reportedMarker]) => {
    expect(() =>
      assertNoTestFixtures([`const fixture="${chunkMarker}"`])
    ).toThrow(`Build contains test fixture marker: ${reportedMarker}`)
  })
})
