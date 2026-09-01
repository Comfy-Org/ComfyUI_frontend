import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const TEST_FIXTURE_MARKERS = [
  'browser_tests/fixtures/',
  '/__fixtures__/',
  'COMFY_PRODUCTION_FORBIDDEN_MOCK_ASSET_SENTINEL'
] as const

const DISTRIBUTIONS = ['localhost', 'desktop', 'cloud'] as const

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
      `Expected one Asset API gate in the build, found ${gates.length}`
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
  const hasDisabledReturn = /return(?: false|!1)/.test(gate)
  const hasSettingLookup = /Comfy\.Assets\.UseAssetAPI/.test(gate)
  const valid =
    distribution === 'cloud'
      ? hasSettingLookup
      : hasDisabledReturn && !hasSettingLookup

  if (!valid) {
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
  const files = artifactFiles(directory)
  const chunks = files
    .filter((path) => extname(path) === '.js')
    .map((path) => readFileSync(path, 'utf8'))
  const expectedCommit = process.env.EXPECTED_FRONTEND_COMMIT
  const expectedDistribution = process.env.EXPECTED_DISTRIBUTION

  if (!expectedCommit) {
    throw new Error('EXPECTED_FRONTEND_COMMIT is required')
  }
  if (!expectedDistribution) {
    throw new Error('EXPECTED_DISTRIBUTION is required')
  }
  assertBuildProvenance(
    readFileSync(join(directory, 'build-manifest.json'), 'utf8'),
    expectedCommit,
    expectedDistribution
  )
  assertNoTestFixtures(chunks)
  assertAssetApiGate(chunks, expectedDistribution)
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkAssetsFlagArtifact()
}
