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

// Tests every run registers whatever the slice holds: allNodes (one
// manifest-coverage test plus four tiers), connectivity (three), coreSmoke
// (two), and the regression spec's three self-checks.
const SLICE_INDEPENDENT_TESTS = 13
// Per pack in the slice: the regression spec's load test, and its interaction
// profile. Run-tier and autogrow rows each add one more, counted separately.
const TESTS_PER_PACK = 2

function expectedTestCount(): number {
  const entries = loadManifest()
  return (
    SLICE_INDEPENDENT_TESTS +
    TESTS_PER_PACK * entries.length +
    entries.filter((entry) => entry.tiers.includes('run')).length +
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
