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
 *   pnpm custom-node-shard --expected-tier-tests
 *                                             how many S1/S2/S3/S9 tests register
 *
 * Reads CUSTOM_NODES_MANIFEST / CUSTOM_NODES_BACKEND / CUSTOM_NODES_SHARD,
 * exactly as the specs do.
 */
import {
  customNodesManifest,
  loadApplicableAutogrowCases,
  loadManifest
} from '../browser_tests/fixtures/customNode/manifest'

// Tests every run registers whatever the slice holds: allNodes's
// manifest-coverage test, connectivity (three), coreSmoke (two), and the
// regression spec's three self-checks. The all-nodes TIERS are counted
// separately because they now register only when the slice contains a pack
// that asks for them.
const SLICE_INDEPENDENT_TESTS = 10
// S1/S2/S3 need a 'load' pack; S9 needs a 'run' pack. A slice with neither
// registers neither.
const LOAD_TIERS = 3
const RUN_TIERS = 1
// Per pack in the slice: the regression spec's load test.
const TESTS_PER_PACK = 1

function expectedTestCount(): number {
  const entries = loadManifest()
  return (
    SLICE_INDEPENDENT_TESTS +
    expectedTierTestCount(entries) +
    TESTS_PER_PACK * entries.length +
    (customNodesManifest() === 'core' ? entries.length : 0) +
    entries.filter((entry) => entry.tiers.includes('run')).length +
    loadApplicableAutogrowCases().length
  )
}

function expectedTierTestCount(entries = loadManifest()): number {
  return (
    (entries.some((entry) => entry.tiers.includes('load')) ? LOAD_TIERS : 0) +
    (entries.some((entry) => entry.tiers.includes('run')) ? RUN_TIERS : 0)
  )
}

function packRows(): string[] {
  return loadManifest().map((entry) => {
    const installRef =
      'repo' in entry ? `${entry.repo}@${entry.pin}` : entry.deployRef
    return `${entry.pack}\t${installRef}`
  })
}

const lines = process.argv.includes('--expected-tests')
  ? [String(expectedTestCount())]
  : process.argv.includes('--expected-tier-tests')
    ? [String(expectedTierTestCount())]
    : packRows()

process.stdout.write(`${lines.join('\n')}\n`)
