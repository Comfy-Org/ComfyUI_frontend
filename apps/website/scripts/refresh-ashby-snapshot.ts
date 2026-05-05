import { renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { fetchRolesForBuild } from '../src/utils/ashby'

const snapshotPath = fileURLToPath(
  new URL('../src/data/ashby-roles.snapshot.json', import.meta.url)
)
const tempPath = `${snapshotPath}.tmp`

const outcome = await fetchRolesForBuild()

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
const totalRoles = outcome.snapshot.departments.reduce(
  (n, d) => n + d.roles.length,
  0
)
process.stdout.write(
  `Wrote snapshot with ${totalRoles} role(s) to ${snapshotPath}\n`
)
