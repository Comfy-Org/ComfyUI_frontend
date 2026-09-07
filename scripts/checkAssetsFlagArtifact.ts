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
 * The widget asset-picker gate must compile to a static constant per
 * distribution: `false`/`!1` off-cloud, meaning the feature is statically
 * stripped, and `true`/`!0` on cloud.
 *
 * The two legs are deliberately asymmetric. `nonCloud` carries the real
 * invariant: a body that folds to a constant `false` proves the picker is
 * unreachable in a non-cloud artifact, which is what lets the bundler drop
 * everything behind it. `cloud` is much weaker — it only proves some static
 * truthy constant survived — but that is honest, because the gate is now
 * nothing more than a build-time constant. Its job is to catch the gate
 * regressing into a runtime read, not to constrain runtime behaviour.
 *
 * Both are anchored against the whole compiled body: a substring search would
 * accept a `return true` sitting beside an extra statement. The alternations
 * are the two spellings minification emits for each literal.
 */
const GATE_BODIES = {
  nonCloud: /^return\s*(?:false|!1)\s*;?$/,
  cloud: /^return\s*(?:true|!0)\s*;?$/
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
 * can't desync the count. Returns the index just past the matching `}`, or
 * -1 if depth never returns to 0.
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
    const declaration = /function isWidgetAssetPickerEnabled\(\)\s*\{/g
    for (const match of chunk.matchAll(declaration)) {
      const start = match.index + match[0].length
      const end = findMatchingBraceEnd(chunk, start)
      if (end !== -1) matches.push(chunk.slice(match.index, end))
    }
    return matches
  })

  if (gates.length !== 1) {
    throw new Error(
      `Expected one widget asset-picker gate in the build, found ${gates.length}. ` +
        'The gate is located by its declared name, which survives minification ' +
        'only while rolldown output.keepNames is set: check that flag, and ' +
        'that the gate was not renamed, inlined, or duplicated across chunks.'
    )
  }

  return gates[0]
}

export function assertWidgetAssetPickerGate(
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
      `Built widget asset-picker gate is invalid for ${distribution}:\n${gate.trim()}`
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
  assertWidgetAssetPickerGate(executableChunks, expectedDistribution)
}

const entrypoint = process.argv.at(1)
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  checkAssetsFlagArtifact()
}
