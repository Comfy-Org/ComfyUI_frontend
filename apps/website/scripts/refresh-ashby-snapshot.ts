import { join } from 'node:path'
import { renameSync, writeFileSync } from 'node:fs'

import { websiteRoot } from '@website/paths'
import { fetchRolesForBuild } from '@/utils/ashby'

const snapshotPath = join(websiteRoot, 'src/data/ashby-roles.snapshot.json')
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
