import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  assertWidgetAssetPickerGate,
  assertBuildProvenance,
  assertNoTestFixtures,
  checkAssetsFlagArtifact
} from './checkAssetsFlagArtifact'

describe('assertWidgetAssetPickerGate', () => {
  it.for(['localhost', 'desktop'])(
    'accepts a disabled %s widget asset-picker gate',
    (distribution) => {
      expect(() =>
        assertWidgetAssetPickerGate(
          ['function isWidgetAssetPickerEnabled() {\n  return false;\n}'],
          distribution
        )
      ).not.toThrow()
    }
  )

  it.for(['localhost', 'desktop'])(
    'accepts a compact disabled %s gate',
    (distribution) => {
      expect(() =>
        assertWidgetAssetPickerGate(
          ['function isWidgetAssetPickerEnabled(){return!1}'],
          distribution
        )
      ).not.toThrow()
    }
  )

  it('accepts a Cloud gate folded to a static true', () => {
    expect(() =>
      assertWidgetAssetPickerGate(
        ['function isWidgetAssetPickerEnabled() {\n  return true;\n}'],
        'cloud'
      )
    ).not.toThrow()
  })

  it('accepts a minified Cloud gate spelling true as !0', () => {
    expect(() =>
      assertWidgetAssetPickerGate(
        ['function isWidgetAssetPickerEnabled(){return!0}'],
        'cloud'
      )
    ).not.toThrow()
  })

  it.for([
    'function isWidgetAssetPickerEnabled() {\n  track();\n  return true;\n}',
    'function isWidgetAssetPickerEnabled() {\n  return isCloud;\n}'
  ])('rejects a Cloud gate that is not a static constant: %s', (gate) => {
    expect(() => assertWidgetAssetPickerGate([gate], 'cloud')).toThrow(
      'Built widget asset-picker gate is invalid for cloud'
    )
  })

  it.for([
    'function isWidgetAssetPickerEnabled() {\n  if (!api.getServerFeature("assets", false)) return false;\n  return true;\n}',
    'function isWidgetAssetPickerEnabled() {\n  if (false) return false;\n  return true;\n}'
  ])('rejects a localhost gate that can still enable: %s', (gate) => {
    expect(() => assertWidgetAssetPickerGate([gate], 'localhost')).toThrow(
      'Built widget asset-picker gate is invalid for localhost'
    )
  })

  it('rejects a localhost artifact that still carries the Cloud branch', () => {
    expect(() =>
      assertWidgetAssetPickerGate(
        [
          'function isWidgetAssetPickerEnabled() {\n  if (!isCloud) return false;\n  return true;\n}'
        ],
        'localhost'
      )
    ).toThrow('Built widget asset-picker gate is invalid for localhost')
  })

  it('rejects a Cloud build whose gate folded to a static false', () => {
    // Pins that the deliberately weak cloud leg is not vacuous: it rejects a
    // constant of the wrong polarity, it does not accept any constant at all.
    expect(() =>
      assertWidgetAssetPickerGate(
        ['function isWidgetAssetPickerEnabled() {\n  return false;\n}'],
        'cloud'
      )
    ).toThrow('Built widget asset-picker gate is invalid for cloud')
  })

  it('rejects a build without exactly one widget asset-picker gate', () => {
    expect(() => assertWidgetAssetPickerGate([], 'localhost')).toThrow(
      'Expected one widget asset-picker gate in the build, found 0'
    )
  })

  it('rejects a build carrying the gate in more than one chunk', () => {
    const gate = 'function isWidgetAssetPickerEnabled() {\n  return false;\n}'

    expect(() =>
      assertWidgetAssetPickerGate([gate, gate], 'localhost')
    ).toThrow('Expected one widget asset-picker gate in the build, found 2')
  })

  it('rejects an unsupported distribution rather than assuming non-cloud', () => {
    expect(() =>
      assertWidgetAssetPickerGate(
        ['function isWidgetAssetPickerEnabled() {\n  return false;\n}'],
        'Cloud'
      )
    ).toThrow('Unsupported distribution: Cloud')
  })

  it('reports a gate with a nested block through its matching brace', () => {
    expect(() =>
      assertWidgetAssetPickerGate(
        [
          'function isWidgetAssetPickerEnabled() {\n  if (!isCloud) {\n    return false\n  }\n  return true\n}'
        ],
        'cloud'
      )
    ).toThrow('  }\n  return true\n}')
  })

  it('does not desync the brace counter on a brace inside a string literal', () => {
    // The gate body contains an unbalanced `{` inside a string. A
    // string-unaware brace counter would count that stray `{` as real,
    // never return to depth 0 within this gate's own body, and run off the
    // end of the chunk - so `assetApiGates` would report "found 0" instead
    // of correctly extracting the one real gate below (which is then
    // rejected on its own merits, for having an extra statement, not for
    // failing to be found at all).
    expect(() =>
      assertWidgetAssetPickerGate(
        [
          'function isWidgetAssetPickerEnabled() {\n  const label = "{unbalanced"\n  return false\n}'
        ],
        'localhost'
      )
    ).toThrow('Built widget asset-picker gate is invalid for localhost')
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
    ).toThrow(
      `Build does not contain expected frontend commit ${commit}, found old`
    )
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
    expect(() => assertBuildProvenance('{', commit, 'desktop')).toThrow(
      SyntaxError
    )
  })

  it.for([
    [JSON.stringify({ distribution: 'desktop' }), 'expected frontend commit'],
    [JSON.stringify({ commit }), 'Build distribution is undefined']
  ])(
    'rejects manifests missing a required field: %s',
    ([manifest, message]) => {
      expect(() => assertBuildProvenance(manifest, commit, 'desktop')).toThrow(
        message
      )
    }
  )
})

describe('assertNoTestFixtures', () => {
  it('accepts production chunks and sourcemap sources', () => {
    expect(() =>
      assertNoTestFixtures(
        ['const endpoint="/api/assets"'],
        ['../../src/platform/assets/services/assetService.ts']
      )
    ).not.toThrow()
  })

  it('accepts a production chunk that merely mentions a path marker in text', () => {
    // A path marker is only meaningful as a module path (a sourcemap
    // `sources` entry). A comment or string in bundled production source that
    // happens to contain the same substring must not fail the build.
    expect(() =>
      assertNoTestFixtures([
        '// see browser_tests/fixtures/ for the fixture format'
      ])
    ).not.toThrow()
  })

  it.for([
    ['browser_tests/fixtures/assets.ts', 'browser_tests/fixtures/'],
    ['/__fixtures__/asset.ts', '/__fixtures__/'],
    ['ui-mock-assets/index.ts', 'ui-mock-assets']
  ])(
    'rejects a sourcemap source path carrying %s',
    ([sourcePath, reportedMarker]) => {
      expect(() => assertNoTestFixtures([], [sourcePath])).toThrow(
        `Build contains test fixture marker: ${reportedMarker}`
      )
    }
  )

  it('rejects the sentinel anywhere in chunk text', () => {
    expect(() =>
      assertNoTestFixtures([
        'const fixture="COMFY_PRODUCTION_FORBIDDEN_MOCK_ASSET_SENTINEL"'
      ])
    ).toThrow(
      'Build contains test fixture marker: COMFY_PRODUCTION_FORBIDDEN_MOCK_ASSET_SENTINEL'
    )
  })
})

describe('checkAssetsFlagArtifact', () => {
  const commit = '0123456789abcdef0123456789abcdef01234567'
  let directory = ''

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'assets-artifact-'))
    mkdirSync(join(directory, 'assets'))
    writeFileSync(
      join(directory, 'build-manifest.json'),
      JSON.stringify({ commit, distribution: 'localhost' })
    )
    writeFileSync(
      join(directory, 'assets', 'chunk.js'),
      'function isWidgetAssetPickerEnabled() {\n  return false;\n}'
    )
    writeFileSync(
      join(directory, 'assets', 'chunk.js.map'),
      JSON.stringify({ version: 3, sources: ['../../src/main.ts'] })
    )
    vi.stubEnv('EXPECTED_FRONTEND_COMMIT', commit)
    vi.stubEnv('EXPECTED_DISTRIBUTION', 'localhost')
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('accepts a verified localhost artifact', () => {
    expect(() => checkAssetsFlagArtifact(directory)).not.toThrow()
  })

  it('does not count a sourcemap copy of the gate as a second gate', () => {
    writeFileSync(
      join(directory, 'assets', 'chunk.js.map'),
      JSON.stringify({
        version: 3,
        sources: ['../../src/platform/assets/services/assetService.ts'],
        sourcesContent: [
          'function isWidgetAssetPickerEnabled() {\n  if (!isCloud) return false\n  return true\n}'
        ]
      })
    )

    expect(() => checkAssetsFlagArtifact(directory)).not.toThrow()
  })

  it('still reads sourcemaps when hunting leaked fixtures', () => {
    writeFileSync(
      join(directory, 'assets', 'chunk.js.map'),
      JSON.stringify({
        version: 3,
        sources: ['../../browser_tests/fixtures/assets.ts'],
        sourcesContent: ['export const assets = []']
      })
    )

    expect(() => checkAssetsFlagArtifact(directory)).toThrow(
      'Build contains test fixture marker: browser_tests/fixtures/'
    )
  })

  it('refuses an artifact built without sourcemaps', () => {
    rmSync(join(directory, 'assets', 'chunk.js.map'))

    expect(() => checkAssetsFlagArtifact(directory)).toThrow(
      'No sourcemap in the artifact'
    )
  })

  it('requires the expected commit even when the distribution is set', () => {
    vi.stubEnv('EXPECTED_FRONTEND_COMMIT', '')

    expect(() => checkAssetsFlagArtifact(directory)).toThrow(
      'EXPECTED_FRONTEND_COMMIT is required'
    )
  })

  it('requires the expected distribution even when the commit is set', () => {
    vi.stubEnv('EXPECTED_DISTRIBUTION', '')

    expect(() => checkAssetsFlagArtifact(directory)).toThrow(
      'EXPECTED_DISTRIBUTION is required'
    )
  })
})
