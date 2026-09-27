import { renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { fetchFeatureFlagsForBuild } from '../src/utils/featureFlags'
import { reportFeatureFlagsOutcome } from '../src/utils/featureFlags.ci'

const snapshotPath = fileURLToPath(
  new URL('../src/data/feature-flags.snapshot.json', import.meta.url)
)
const tempPath = `${snapshotPath}.tmp`

const outcome = await fetchFeatureFlagsForBuild()
reportFeatureFlagsOutcome(outcome)

if (outcome.status === 'failed') {
  const reason = 'reason' in outcome ? outcome.reason : '(none)'
  console.error(
    `Snapshot refresh aborted. Outcome: ${outcome.status}; reason: ${reason}`
  )
  process.exit(1)
}

if (outcome.status === 'stale') {
  process.stdout.write('Using the committed feature flags snapshot.\n')
  process.exit(0)
}

writeFileSync(
  tempPath,
  JSON.stringify(outcome.snapshot, null, 2) + '\n',
  'utf8'
)
renameSync(tempPath, snapshotPath)
process.stdout.write(
  `Wrote feature flags snapshot to ${snapshotPath}: cloudFreeTier=${outcome.snapshot.flags.cloudFreeTier}\n`
)
