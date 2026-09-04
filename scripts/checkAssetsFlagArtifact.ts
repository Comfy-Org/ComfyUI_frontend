import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Path markers: only meaningful as a module path, so they are checked against
 * a sourcemap's `sources` array, never against arbitrary chunk/sourcesContent
 * text. A production module that merely mentions one of these strings in a
 * comment or a string literal must not fail the build.
 */
const TEST_FIXTURE_PATH_MARKERS = [
  'browser_tests/fixtures/',
  '/__fixtures__/',
  'ui-mock-assets'
] as const

/**
 * The sentinel is a value, not a path: it can appear anywhere in bundled
 * source (a mock asset id inlined into a chunk), so it stays a full-text scan
 * across every chunk, including sourcesContent.
 */
const TEST_FIXTURE_SENTINEL = 'COMFY_PRODUCTION_FORBIDDEN_MOCK_ASSET_SENTINEL'

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

/**
 * Walk `chunk` from `start`, tracking brace depth until it returns to 0.
 * Skips braces inside string/template literals so a `{` in a quoted value
 * (e.g. a re-quoted setting key) can't desync the count. Returns the index
 * just past the matching `}`, or -1 if depth never returns to 0.
 */
function findMatchingBraceEnd(chunk: string, start: number): number {
  let depth = 1
  let quote: '"' | "'" | '`' | null = null
  let index = start
  for (; index < chunk.length && depth > 0; index++) {
    const char = chunk[index]
    if (quote) {
      if (char === '\\') index++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') quote = char
    else if (char === '{') depth++
    else if (char === '}') depth--
  }
  return depth === 0 ? index : -1
}

function assetApiGates(chunks: ReadonlyArray<string>): string {
  const gates = chunks.flatMap((chunk) => {
    const matches: string[] = []
    const declaration = /function isAssetAPIEnabled\(\)\s*\{/g
    for (const match of chunk.matchAll(declaration)) {
      const start = (match.index ?? 0) + match[0].length
      const end = findMatchingBraceEnd(chunk, start)
      if (end !== -1) matches.push(chunk.slice(match.index, end))
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
      `Build does not contain expected frontend commit ${expectedCommit}, found ${String(build.commit)}`
    )
  }
  if (build.distribution !== expectedDistribution) {
    throw new Error(
      `Build distribution is ${String(build.distribution)}, expected ${expectedDistribution}`
    )
  }
}

/** A parsed sourcemap's relevant fields, tolerant of malformed/missing ones. */
function sourcemapSources(mapSource: string): string[] {
  try {
    const parsed: unknown = JSON.parse(mapSource)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as { sources?: unknown }).sources)
    ) {
      return (parsed as { sources: unknown[] }).sources.filter(
        (source): source is string => typeof source === 'string'
      )
    }
  } catch {
    // Malformed sourcemap JSON: fall through and treat as no sources, so a
    // parse failure here doesn't mask the assertions below.
  }
  return []
}

export function assertNoTestFixtures(
  chunks: ReadonlyArray<string>,
  sourcemapSourcePaths: ReadonlyArray<string> = []
): void {
  for (const marker of TEST_FIXTURE_PATH_MARKERS) {
    if (sourcemapSourcePaths.some((source) => source.includes(marker))) {
      throw new Error(`Build contains test fixture marker: ${marker}`)
    }
  }
  if (chunks.some((chunk) => chunk.includes(TEST_FIXTURE_SENTINEL))) {
    throw new Error(
      `Build contains test fixture marker: ${TEST_FIXTURE_SENTINEL}`
    )
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

  // Check provenance before anything else: a stale `dist/` from a build that
  // predates the sourcemap requirement (or any other assertion below) should
  // report "wrong commit", not a confusing downstream failure.
  assertBuildProvenance(
    readFileSync(join(directory, 'build-manifest.json'), 'utf8'),
    expectedCommit,
    expectedDistribution
  )

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
  const sourcemapSourcePaths = textAssets
    .filter(({ path }) => extname(path) === '.map')
    .flatMap(({ source }) => sourcemapSources(source))

  assertNoTestFixtures(chunks, sourcemapSourcePaths)
  assertAssetApiGate(executableChunks, expectedDistribution)
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkAssetsFlagArtifact()
}
