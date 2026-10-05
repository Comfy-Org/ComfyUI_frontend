import { join } from 'node:path'
import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

import { websiteRoot } from '@website/paths'
import { fetchFeatureFlagsForBuild } from '@/utils/featureFlags'
import { reportFeatureFlagsOutcome } from '@/utils/featureFlags.ci'

const snapshotPath = join(websiteRoot, 'src/data/feature-flags.snapshot.json')
const tempPath = `${snapshotPath}.${process.pid}.${randomUUID()}.tmp`

const outcome = await fetchFeatureFlagsForBuild()
reportFeatureFlagsOutcome(outcome)

if (outcome.status === 'failed') {
  const reason = 'reason' in outcome ? outcome.reason : '(none)'
  console.error(
    `Snapshot refresh aborted. Outcome: ${outcome.status}; reason: ${reason}`
  )
  process.exitCode = 1
} else if (outcome.status === 'stale') {
  process.stdout.write('Using the committed feature flags snapshot.\n')
} else {
  try {
    writeFileSync(
      tempPath,
      JSON.stringify(outcome.snapshot, null, 2) + '\n',
      'utf8'
    )
    renameSync(tempPath, snapshotPath)
    process.stdout.write(
      `Wrote feature flags snapshot to ${snapshotPath}: cloudFreeTier=${outcome.snapshot.flags.cloudFreeTier}\n`
    )
  } finally {
    rmSync(tempPath, { force: true })
  }
}
