import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const TEST_FIXTURE_MARKERS = [
  'browser_tests/fixtures/',
  '/__fixtures__/',
  'ui-mock-assets',
  'COMFY_PRODUCTION_FORBIDDEN_MOCK_ASSET_SENTINEL'
] as const

const DISTRIBUTIONS = ['localhost', 'desktop', 'cloud'] as const
const TEXT_ASSET_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.html',
  '.json',
  '.css',
  '.map'
])
/** Sourcemaps carry the gate's own source, which would count as a second gate. */
const EXECUTABLE_ASSET_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html'])

/**
 * The whole compiled gate body, anchored: a substring search accepts a
 * `return true` sitting next to a mention of the setting key. The alternations
 * are what minification emits — `return!1`, a renamed getter, a re-quoted key.
 */
const GATE_BODIES = {
  nonCloud: /^return\s*(?:false|!1)\s*;?$/,
  cloud:
    /^return\s*!!\s*[\w$.]+(?:\(\))?\.get\(\s*(['"`])Comfy\.Assets\.UseAssetAPI\1\s*\)\s*;?$/
} as const

function artifactFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return artifactFiles(path)
    return [path]
  })
}

function assetApiGates(chunks: ReadonlyArray<string>): string {
  const gates = chunks.flatMap((chunk) => {
    const matches: string[] = []
    const declaration = /function isAssetAPIEnabled\(\)\s*\{/g
    for (const match of chunk.matchAll(declaration)) {
      let depth = 1
      let index = (match.index ?? 0) + match[0].length
      for (; index < chunk.length && depth > 0; index++) {
        if (chunk[index] === '{') depth++
        if (chunk[index] === '}') depth--
      }
      if (depth === 0) matches.push(chunk.slice(match.index, index))
    }
    return matches
  })

  if (gates.length !== 1) {
    throw new Error(
      `Expected one Asset API gate in the build, found ${gates.length}. ` +
        'The gate is located by its declared name, which survives minification ' +
        'only while rolldown output.keepNames is set: check that flag, and ' +
        'that the gate was not renamed, inlined, or duplicated across chunks.'
    )
  }

  return gates[0]
}

export function assertAssetApiGate(
  chunks: ReadonlyArray<string>,
  distribution: string
): void {
  if (!DISTRIBUTIONS.includes(distribution as (typeof DISTRIBUTIONS)[number])) {
    throw new Error(`Unsupported distribution: ${distribution}`)
  }
  const gate = assetApiGates(chunks)
  const body = gate.slice(gate.indexOf('{') + 1, gate.lastIndexOf('}')).trim()
  const expected =
    distribution === 'cloud' ? GATE_BODIES.cloud : GATE_BODIES.nonCloud

  if (!expected.test(body)) {
    throw new Error(
      `Built Asset API gate is invalid for ${distribution}:\n${gate.trim()}`
    )
  }
}

export function assertBuildProvenance(
  manifest: string,
  expectedCommit: string,
  expectedDistribution: string
): void {
  const parsed: unknown = JSON.parse(manifest)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Build manifest must be a JSON object')
  }
  const build = parsed as Record<string, unknown>
  if (build.commit !== expectedCommit) {
    throw new Error(
      `Build does not contain expected frontend commit ${expectedCommit}`
    )
  }
  if (build.distribution !== expectedDistribution) {
    throw new Error(
      `Build distribution is ${String(build.distribution)}, expected ${expectedDistribution}`
    )
  }
}

export function assertNoTestFixtures(chunks: ReadonlyArray<string>): void {
  for (const marker of TEST_FIXTURE_MARKERS) {
    if (chunks.some((chunk) => chunk.includes(marker))) {
      throw new Error(`Build contains test fixture marker: ${marker}`)
    }
  }
}

export function checkAssetsFlagArtifact(directory = 'dist'): void {
  const expectedCommit = process.env.EXPECTED_FRONTEND_COMMIT
  const expectedDistribution = process.env.EXPECTED_DISTRIBUTION

  if (!expectedCommit) {
    throw new Error('EXPECTED_FRONTEND_COMMIT is required')
  }
  if (!expectedDistribution) {
    throw new Error('EXPECTED_DISTRIBUTION is required')
  }

  const textAssets = artifactFiles(directory)
    .filter((path) => TEXT_ASSET_EXTENSIONS.has(extname(path)))
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
  if (!textAssets.some(({ path }) => extname(path) === '.map')) {
    throw new Error(
      'No sourcemap in the artifact. Every fixture marker except the ' +
        'sentinel is a module path, which survives only in a .map, so this ' +
        'scan would silently cover almost nothing. Build with sourcemaps.'
    )
  }
  const chunks = textAssets.map(({ source }) => source)
  const executableChunks = textAssets
    .filter(({ path }) => EXECUTABLE_ASSET_EXTENSIONS.has(extname(path)))
    .map(({ source }) => source)

  assertBuildProvenance(
    readFileSync(join(directory, 'build-manifest.json'), 'utf8'),
    expectedCommit,
    expectedDistribution
  )
  assertNoTestFixtures(chunks)
  assertAssetApiGate(executableChunks, expectedDistribution)
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkAssetsFlagArtifact()
}
