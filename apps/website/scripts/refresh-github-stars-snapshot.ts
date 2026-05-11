import { renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { fetchGitHubStarsForBuild } from '../src/utils/github'

const snapshotPath = fileURLToPath(
  new URL('../src/data/github-stars.snapshot.json', import.meta.url)
)
const tempPath = `${snapshotPath}.tmp`

const outcome = await fetchGitHubStarsForBuild()

if (outcome.status !== 'fresh') {
  const reason = 'reason' in outcome ? outcome.reason : '(none)'
  console.error(
    `Snapshot refresh aborted. Outcome: ${outcome.status}; reason: ${reason}`
  )
  process.exit(1)
}

writeFileSync(
  tempPath,
  JSON.stringify(outcome.snapshot, null, 2) + '\n',
  'utf8'
)
renameSync(tempPath, snapshotPath)
process.stdout.write(
  `Wrote snapshot with ${outcome.snapshot.stargazersCount} star(s) to ${snapshotPath}\n`
)
