/**
 * Which packs this shard owns, for the CI install loop.
 *
 * The workflow installs packs and the specs register tests against them. If
 * the two ever disagreed about the slice, the shard would install packs no
 * test exercises and register tests for packs the backend does not have - so
 * both read it from loadManifest(), and the workflow never re-derives the
 * stripe itself.
 *
 *   pnpm custom-node-shard                   pack<TAB>deployRef, one per line
 *   pnpm custom-node-shard --expected-tests  how many tests that slice registers
 *
 * Reads CUSTOM_NODES_MANIFEST / CUSTOM_NODES_BACKEND / CUSTOM_NODES_SHARD,
 * exactly as the specs do.
 */
import {
  loadApplicableAutogrowCases,
  loadManifest,
  packIdentity
} from '../browser_tests/fixtures/customNode/manifest'

// Tests every run registers whatever the slice holds: allNodes's
// manifest-coverage test, connectivity (three), coreSmoke (two), and the
// regression spec's three self-checks. The all-nodes TIERS are counted
// separately because they now register only when the slice contains a pack
// that asks for them.
const SLICE_INDEPENDENT_TESTS = 9
// S1/S2/S3 need a 'load' pack; S9 needs a 'run' pack. A slice with neither
// registers neither.
const LOAD_TIERS = 3
const RUN_TIERS = 1
// Per pack in the slice: the regression spec's load test, and its interaction
// profile. Run-tier and autogrow rows each add one more, counted separately.
const TESTS_PER_PACK = 2

function expectedTestCount(): number {
  const entries = loadManifest()
  const runPacks = entries.filter((entry) => entry.tiers.includes('run'))
  const loadPacks = entries.filter((entry) => entry.tiers.includes('load'))
  return (
    SLICE_INDEPENDENT_TESTS +
    (loadPacks.length > 0 ? LOAD_TIERS : 0) +
    (runPacks.length > 0 ? RUN_TIERS : 0) +
    TESTS_PER_PACK * entries.length +
    runPacks.length +
    loadApplicableAutogrowCases().length
  )
}

function packRows(): string[] {
  return loadManifest().map((entry) => `${entry.pack}\t${packIdentity(entry)}`)
}

const lines = process.argv.includes('--expected-tests')
  ? [String(expectedTestCount())]
  : packRows()

process.stdout.write(`${lines.join('\n')}\n`)
